Here is a summary of the changes made, formatted for the PR description:

## Manual Updates

This PR includes manual updates to resolve CI failures and simplify the Renovate configuration:

1.  **Fixed CI Failure (`ERR_PNPM_OUTDATED_LOCKFILE`)**
    *   Updated the root `package.json` `@types/node` constraint from `^22.0.0` to `~24.10.0` to align with the workspace updates in this PR.
    *   Regenerated `pnpm-lock.yaml` to resolve the version mismatch.

2.  **Refactored Renovate Configuration**
    *   Simplified `renovate.json` to group dependencies into two categories:
        *   **`critical-deps`**: High-priority peer dependencies (`react`, `vite`, `wrangler`, `@cloudflare/*`) that update immediately.
        *   **`regular-deps`**: All other dependencies (internal tools, docs, infra) grouped into a weekly schedule.
    *   Updated `CONTRIBUTING.md` to reflect these changes.
