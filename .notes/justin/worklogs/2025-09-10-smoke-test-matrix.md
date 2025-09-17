# Work Log: 2025-09-10 - Implementing the Smoke Test Matrix

## 1. Problem Definition

The existing smoke test suite was limited, running only with `pnpm` on a single operating system. This provided a narrow view of the framework's compatibility and created a risk that environment-specific bugs could go undetected. To ensure stability and broad compatibility, the goal was to expand the smoke tests to run across a matrix of common package managers (`pnpm`, `npm`, `yarn`, `yarn-classic`) and operating systems (`linux`, `windows`).

## 2. Initial Implementation: Building the Matrix

The first phase involved straightforward modifications to the testing infrastructure to support the matrix concept:

1.  A `PackageManager` type was added to the smoke test interfaces.
2.  The core test scripts were updated to accept a `--package-manager` CLI argument, allowing tests to be invoked for a specific manager.
3.  The test environment setup logic was modified to dynamically select the correct installation commands (`npm install`, `yarn install`, etc.) based on the specified package manager.
4.  The GitHub Actions workflow was converted from a series of separate jobs into a `matrix` strategy, configured to generate jobs for all 16 combinations (2 starters × 2 OSes × 4 package managers).

This initial setup established the structure for the matrix but quickly revealed a series of environment-specific challenges.

## 3. Investigation #1: Solving `ENOENT` Failures

The first CI runs for the expanded matrix failed immediately with `ENOENT` errors, indicating that the shell could not find the specified package manager commands.

**Root Cause:** The investigation traced the problem to an incorrect usage of the `execa` library's template literal syntax. The code was attempting to pass a command and its arguments as a single string (e.g., `` `${['pnpm', 'install']}` ``), which `execa` does not parse correctly.

**Solution:** The fix was to refactor the `execa` calls to pass the command and arguments as separate parameters, which is the correct invocation pattern:

```typescript
// Before (broken)
const result = await $`{installCommand}`;

// After (working)
const [command, ...args] = installCommand;
const result = await $(command, args);
```

This resolved the command execution failures and allowed the tests to proceed to the dependency installation phase.

## 4. Investigation #2: Yarn's "Hardened Mode" in CI

With the execution issue fixed, a new problem emerged specific to Yarn. The installations were failing with the error: `YN0028: The lockfile would have been created by this install, which is explicitly forbidden.`

**Root Cause:** This error is a security feature of Yarn's "hardened mode," which is often enabled by default in CI environments. It prevents the `yarn install` command from creating or modifying a lockfile. Our starter projects are intentionally checked into the repository *without* lockfiles, so this was a direct conflict.

**Solution:** The solution was to explicitly create the `yarn.lock` file as a separate, preliminary step in the CI workflow *before* the main smoke test installation was run. This satisfied Yarn's requirement for an existing lockfile.

## 5. Investigation #3: The Root `packageManager` Conflict

Even with a pre-generated `yarn.lock`, the Yarn jobs continued to fail, but with a new, more confusing error: `"This project is configured to use pnpm because /home/runner/work/sdk/sdk/package.json has a 'packageManager' field"`.

**Root Cause:** The investigation revealed that Yarn's command-line tool traverses up the directory tree from the starter project's location. During this traversal, it was discovering the `package.json` file at the root of our monorepo, which contains the `"packageManager": "pnpm@..."` field used to enforce `pnpm` for the main project's development. Upon finding this, Yarn correctly concluded that it was being run in a `pnpm` workspace and refused to proceed.

**Solution:** The only way to solve this was to completely isolate the starter projects from the monorepo's root during the installation step. This was achieved by copying the starter project's contents to a temporary directory, running the package manager's install command inside that isolated directory, and then copying the generated lockfile back to the original location.

```bash
temp_dir=$(mktemp -d)
cp -r "$starter"/* "$temp_dir/"
(cd "$temp_dir" && yarn install)
cp "$temp_dir/yarn.lock" "$starter/"
rm -rf "$temp_dir"
```

This workaround successfully shielded Yarn from the influence of the parent workspace's configuration.

## 6. Current Status: Development Server Timeouts

With the package manager installation issues resolved, the matrix is now consistently reaching the stage where it runs the application's dev server. However, a new blocking issue has emerged: the `pnpm` and `npm` jobs are now failing with a "Timed out waiting for dev server URL" error.

**Key Finding:** The most important insight is that the *production* build and tests for these same jobs are passing. This proves that the core framework functionality is working correctly across all package managers. The problem is isolated specifically to the development server environment.

The current hypothesis is that different package managers are causing the dev server to produce slightly different startup output, and our URL detection logic, which scans the server's stdout, is not flexible enough to handle these variations.

**Next Steps:** The immediate focus is to debug the dev server URL detection. This will involve capturing and analyzing the stdout from `pnpm`, `npm`, and `yarn` runs to identify the differences in their output patterns and update the detection logic to be more robust.