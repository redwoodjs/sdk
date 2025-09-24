## Problem

ESBuild, running as part of Vite's dependency optimization step, is unable to resolve framework-internal modules like `rwsdk/worker`. This occurs when third-party dependencies in `node_modules` (e.g., Radix UI) are transformed to include imports from the framework. The issue appears to be specific to projects using Yarn Berry, even with the `node-modules` linker.

The framework's own `esbuild`-based scanner resolves these modules correctly, likely because it uses `enhanced-resolve`. However, Vite's optimizer does not seem to respect the aliases configured by the framework's Vite plugin, leading to resolution failures.

## Investigation and Findings

The initial plan to add a manual alias in the user's `vite.config.mts` was incorrect. It was a workaround, not a framework-level solution, and it interfered with the framework's own internal module scanner.

The core issue was identified as an **inverted resolution path**, which is common in monorepos using Yarn Berry's hoisting strategy.

1.  **Importer Location:** A dependency like `@radix-ui/react-dialog` is hoisted to the monorepo root's `node_modules` directory.
2.  **Importee Location:** The framework package, `rwsdk`, is installed in the workspace's `node_modules` directory (`apps/dashboard/node_modules`).
3.  **Resolution Failure:** Vite's `optimizeDeps` scanner runs `esbuild` starting from the Radix file at the monorepo root. A standard Node.js resolver walks *up* the directory tree from the file's location. It never looks *down* into the workspace's `node_modules` directory and therefore cannot find `rwsdk`.

This was confirmed by an experiment: when the Radix dependency was moved from the root into the workspace's `package.json` (preventing it from being hoisted), the resolution worked correctly. This confirms the problem is not a flaw in our framework's build logic itself, but a complex resolution context that the framework must handle.

## Proposed Solutions

Two primary strategies were identified to create a robust, framework-level fix without requiring user configuration.

### Approach A: Absolute Path Injection at Transform Time

This approach involves modifying the code transformation logic itself.

-   **How it works:** In every place where we inject an import to a framework module (e.g., in `transformClientComponents.mts`), instead of writing a bare specifier like `"rwsdk/worker"`, we would first resolve it to its absolute on-disk path from the perspective of the user's project. The transformed code would then contain the full, resolved path.
-   **Pros:** Direct and conceptually simple. The fix is applied exactly where the problematic import is created.
-   **Cons:** The resolution logic would be duplicated across multiple transform-related files. It could introduce potential brittleness if bundlers or caches have issues with absolute paths in source code.

### Approach B: Centralized `esbuild` Resolver Plugin

This approach involves teaching Vite's optimizer how to resolve the framework's modules correctly.

-   **How it works:** We would create a small, dedicated `esbuild` plugin. This plugin's sole purpose is to intercept imports beginning with `rwsdk/`. When it finds one, it uses Node's `require.resolve` API to find the module, but critically, it initiates the resolution from the user's project root directory. This plugin would then be injected into Vite's `optimizeDeps.esbuildOptions` from our main framework plugin.
-   **Pros:** Centralizes all optimizer-related resolution logic into a single, clean module. It is a more robust and scalable solution that keeps the generated code clean with standard import specifiers.
-   **Cons:** Slightly more abstract, as it involves hooking into a specific, internal part of Vite's build process.

## Final Plan

After discussion, Approach B was selected. It provides a more robust and maintainable solution by centralizing the resolution logic within the framework, rather than requiring users to configure workarounds or scattering resolution logic across multiple transform files.

The implementation will involve generalizing the existing `reactConditionsResolverPlugin`. This plugin already uses `enhanced-resolve` and hooks into Vite's `optimizeDeps` process, providing the exact mechanism needed. The plan is to:

1.  **Rename and Generalize:** Rename the plugin to `knownDependenciesResolverPlugin` and update its internal variables to use generic names (e.g., `KNOWN_PREFIXES` instead of `REACT_PREFIXES`).
2.  **Extend to `rwsdk`:** Add `'rwsdk'` to the list of `KNOWN_PREFIXES`.
3.  **Leverage Existing Logic:** The plugin's core logic, which resolves imports from the user's project root using environment-specific conditions, will now automatically apply to `rwsdk` imports, fixing the resolution issue for Vite's optimizer.

This approach solves the problem elegantly by reusing and extending a battle-tested part of the framework's build process.

## Update: Symlink Resolution Mismatch

Further testing revealed a deeper issue. Even with the correct resolver in place for `optimizeDeps`, the `use client` module lookup was failing during server-side rendering.

The root cause is a discrepancy in how paths are handled:

-   **Vite/esbuild** resolves all symlinks in a file's path to get its canonical, "real" path on the filesystem. It uses this real path when processing the module.
-   **Our Directive Scanner** was operating on the original, symlinked path.

This created a mismatch where our internal module map was keyed by the symlink path, but Vite was requesting the module using its real path, resulting in a lookup failure.

The solution is to ensure our scanner also operates on real paths by using `fs.realpathSync()` on every discovered module path before storing it.

## Test Plan: Simulating the Monorepo Environment

To validate the chosen solution (Approach B), a new playground example, `monorepo-yarn-hoist`, will be created to reliably reproduce the resolution error in an isolated environment.

1.  **Simulate Monorepo Structure:** The playground will contain a nested directory structure that mimics a monorepo:
    -   `packages/project/`: A copy of the `hello-world` application.
    -   `vendor/ui-lib/`: A local, fake UI library that acts as the "hoisted" dependency.
    -   A root `package.json` and `pnpm-workspace.yaml` will define this structure as a pnpm workspace.

2.  **Recreate Hoisting Scenario:**
    -   The root `package.json` will depend on `ui-lib` via the `file:` protocol, causing pnpm to link it to the root `node_modules`.
    -   The `packages/project/package.json` will depend on `rwsdk` (via `workspace:*`) and `ui-lib`. `rwsdk` will be installed in the project's local `node_modules`, while `ui-lib` will be resolved from the root.

3.  **Trigger the Resolution Failure:**
    -   The `ui-lib` will contain a simple component with a `"use client"` directive.
    -   The `Home.tsx` page in the `project` will import and use this component.
    -   This setup forces Vite's optimizer to scan a file (`ui-lib`) from a root context that then requires a module (`rwsdk`) located in a nested context, triggering the resolution failure.

4.  **Validation:** An end-to-end test will be created to run the dev server for the playground. This test will initially fail, confirming the bug reproduction. It will then be used to verify that the implemented fix (the esbuild resolver plugin) solves the issue.

## PR Content

### fix(vite): Improve monorepo support for dependency scanning

This change improves support for monorepo environments where dependencies are hoisted to the root `node_modules` directory.

#### Problem

In certain monorepo configurations (e.g., using Yarn Berry or pnpm workspaces), Vite's `optimizeDeps` scanner and the framework's internal directive scanner could fail to resolve `rwsdk` modules. This was caused by two distinct issues:

1.  **Optimizer Resolution Failure:** When a third-party dependency (like Radix UI) was hoisted to the monorepo root, Vite's `optimizeDeps` scanner would try to resolve `rwsdk` imports from the root. It would fail because it had no awareness of the `rwsdk` package located in a nested workspace's `node_modules` directory.
2.  **Symlink Path Mismatch:** Even when the optimizer was fixed, the framework's "use client" module lookup would fail during SSR. This was because our directive scanner operated on the original, symlinked path of a module, while Vite's SSR process used the real, canonical path, leading to a key mismatch in our lookup maps.

#### Solution

This was addressed with a two-part, framework-level fix that requires no user configuration:

1.  **Generalized Dependency Resolver:** The existing `reactConditionsResolverPlugin` has been generalized into a `knownDependenciesResolverPlugin`. This plugin, which uses `enhanced-resolve`, now handles `rwsdk` imports in addition to React's. It correctly resolves these dependencies from the user's project root, making Vite's optimizer aware of their location.
2.  **Canonical Path Resolution:** The `runDirectivesScan` plugin was updated to use `fs.realpath` on all discovered module paths. This ensures that the framework's internal maps are keyed by the canonical file path, matching Vite's behavior and preventing lookup failures during SSR.

A new playground, `monorepo-yarn-hoist`, was created to reliably reproduce this specific hoisting scenario and validate the fix.

## Update: Unexpected Re-optimization

After fixing the symlink resolution, the e2e test revealed a new issue: Vite's dependency optimizer is re-running for `rwsdk` modules (e.g., `rwsdk/router`) after the initial scan. This causes a full-page reload and leads to a runtime error: `TypeError: Cannot read properties of undefined (reading 'scriptsToBeLoaded')`.

This re-optimization is problematic because it can lead to duplicate instances of the framework's modules being loaded, which breaks internal state management that relies on singletons (like `AsyncLocalStorage` for request context).

The root cause of this re-optimization needs to be investigated. It should not be happening if all dependencies are correctly discovered during the initial scan. As an immediate mitigation to unblock testing, all known `rwsdk` entry points will be explicitly added to `optimizeDeps.include`.
