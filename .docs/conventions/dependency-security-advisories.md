# Dependency security advisories

This convention describes how we handle dependency security advisories in the RedwoodSDK monorepo.

## 1. Discover advisories with `pnpm audit`

Run the audit across the workspace:

```sh
pnpm audit --json
```

We treat `critical` and `high` advisories as must-fix in the same session when a patch is available. We also fix `moderate` and `low` advisories when the fix is low-risk.

## 2. Classify each advisory as direct or transitive

Use `pnpm why <package> --json` to see how the vulnerable package enters the tree.

- **Direct dependency**: the affected package is declared in a workspace `package.json` (including dev and peer dependencies).
- **Transitive dependency**: the affected package is pulled in by another package.

## 3. Direct dependencies: bump the declared range

If the vulnerable package is declared directly, update its range in the relevant `package.json` to a patched version. When the same package is declared in many workspace packages (for example, `vite` in `sdk`, `community`, `docs`, `starter`, and multiple `playground/` apps), update every direct declaration so the change is consistent across the workspace.

If the vulnerable package is transitive but the direct parent already publishes a range that allows the patched version, a root pnpm override is enough. In the PR, explain that the published package is unchanged and downstream installs already accept the fixed version.

## 4. Transitive dependencies: add a root pnpm override

Add the override to `pnpm.overrides` in the root `package.json`. Rules for the override key:

- Use the package's published name. Unscoped packages use the bare name (`brace-expansion@>=5.0.0 <5.0.6`). Scoped packages use `@scope/name@version` (`@cloudflare/vite-plugin@1.30.1`).
- Use a version range that matches the vulnerable versions actually being resolved.
- Point to the minimum patched version that keeps the tree working. Avoid unnecessary major-version jumps.
- Multiple ranges for the same package are allowed when different chains resolve different versions (`serialize-javascript@6.0.2` and `serialize-javascript@7.0.3`).

## 5. Refresh the lockfile and re-run the audit

```sh
pnpm install --lockfile-only
pnpm audit --json
```

Re-run the audit until the fixed advisories disappear. If unrelated changes appear in `pnpm-lock.yaml`, trim them back so the PR only contains the advisory-related diff.

## 6. Verify with CI

Before finishing, run the local agent CI check:

```sh
AI_AGENT=1 npx @redwoodjs/agent-ci run --all
```

For security-only changes, also keep the `pnpm audit` output in the worklog as proof.

## 7. Branch, commit, and pull-request

Branch naming examples:

- `fix/resolve-tmp-advisory`
- `chore/kysely-ghsa-pv5w-4p9q-p3v2`
- `fix/resolve-dependency-advisories`

Commit message style: `fix(deps): bump kysely to 0.28.17` or `fix: resolve tmp advisory`.

### Pull-request body shape

Keep the tone low-key and factual. A good security PR body contains:

- **Context**: which advisories `pnpm audit` reported and the paths they take through the tree.
- **What we checked**: whether the vulnerable package is direct or transitive, and whether the direct parent's published range already allows the patched version.
- **Solution**: which `package.json` ranges changed and which pnpm overrides were added or updated.
- **Why this is enough**: for overrides, note that they are local to the workspace and do not change the published SDK. For direct bumps, note consumer impact and the upgrade command.
- **Verification**: the commands run (`pnpm audit --json`, agent-ci, etc.).
- **Dependency audit table** (optional): package, whether it is in the SDK tree, and consumer impact.

## 8. Communicate to consumers when the SDK is affected

For high or critical advisories that reach the published SDK (for example, through a direct dependency of `rwsdk`), draft a security note. Store it in `~/notes/rw/rwsdk/comms/YYYY-MM-DD-<advisory>.md`.

The note should:

- Say who is affected and who is not.
- Give the exact upgrade commands for both stable and canary release tracks.
- Link to the advisory.
- Avoid alarmist language.

Example upgrade commands:

```sh
pnpm update kysely
pnpm release
```

or

```sh
pnpm add rwsdk@latest
pnpm release
```

## 9. Cherry-pick to `next` when needed

If the repo has an active `next` release branch, cherry-pick the merged security commit onto `next` so both release tracks get the fix.
