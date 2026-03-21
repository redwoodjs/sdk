# Vite + Wrangler Dependency Bumps

## Task Narrative

A Dependabot PR was accidentally closed and deleted. It targeted `playground/base-path` and proposed bumping vite from `7.1.9` → `7.1.11` and wrangler from `4.42.0` → `4.59.1`. We were asked to ensure all packages had at least those versions. It turned out the monorepo was already ahead of those targets on most packages (vite `7.3.1`, wrangler `4.71.0`), so the real task was to bring the stragglers up to the same line and merge in the main branch, which had landed the `playground/base-path` playground in the interim.

## Synthesized Context

- Root `package.json` pins wrangler `^4.71.0` in devDependencies and applies a `vite@7.1.9 -> 7.3.1` override in `pnpm.overrides`.
- Individual playground `package.json` files pin exact versions — most were already `vite: 7.3.1` / `wrangler: 4.71.0`.
- `playground/base-path` did not exist on the branch yet — it was introduced on `main` with the old Dependabot-era versions still intact.

## Known Unknowns (at start)

- Whether `main` had already landed `playground/base-path` with the old versions.
- Whether other packages besides `server-decorators` were behind.

## Investigation Findings

Scanned all 47 workspace `package.json` files for `"vite"` and `"wrangler"` entries. Results:

| Package | vite | wrangler |
|---|---|---|
| All playground/* (except below) | 7.3.1 | 4.71.0 |
| `playground/server-decorators` | 7.3.1 | **4.66.0** |
| `playground/base-path` (post-merge) | **7.1.9** | **4.42.0** |

`playground/base-path` was not in the branch at the time of first scan — it only appeared after merging `origin/main`.

## Implementation

### Task 1: Bump server-decorators wrangler

Updated `playground/server-decorators/package.json`: `wrangler: 4.66.0` → `4.71.0`. Ran `pnpm i`.

### Task 2: Merge origin/main

`origin/main` was 2 commits ahead, bringing:
- `playground/base-path` — new playground for vite base path feature
- SDK changes: `stripBase` utility, router updates, plugin updates
- `playground/kitchen-sink` test/component additions

Merge produced a single conflict in `pnpm-lock.yaml`. Resolved by taking main's version (`git checkout --theirs pnpm-lock.yaml`), then running `pnpm i` to fold in our `server-decorators` bump.

### Task 3: Bump base-path vite/wrangler

After merge, `playground/base-path/package.json` had the original Dependabot-era versions:
- `vite: 7.1.9` → `7.3.1`
- `wrangler: 4.42.0` → `4.71.0`

Ran `pnpm i` again. Committed merge.

## Finalization Report

### Decisions Made

- Took `--theirs` on `pnpm-lock.yaml` during merge conflict: main's lockfile was the more complete base since it contained the new `base-path` playground deps; our only addition was a wrangler bump for one package, which `pnpm i` reapplied cleanly on top.
- Aligned all explicit version pins to `7.3.1` / `4.71.0` (current monorepo standard) rather than just the Dependabot minimums (`7.1.11` / `4.59.1`), since the monorepo is already well ahead of those.

### Assumptions

- `7.3.1` and `4.71.0` are the correct targets — they are what all other playground packages in the repo use.
- The pre-existing peer dependency warnings (storybook, vitest-pool-workers, react-server-dom-webpack, etc.) are known and pre-existing; not introduced by this change.

### Hurdles Encountered

- `playground/base-path` didn't exist on the branch at first pass — it appeared on `main` with the exact outdated versions Dependabot was targeting. Caught this post-merge.

### Provisional Decisions

None.

### Open Questions

- `playground/base-path` and `playground/server-decorators` both show a peer dep warning for `wrangler 4.71.0` requiring `@cloudflare/workers-types@^4.20260226.1` but finding an older version. This is the same pre-existing pattern seen elsewhere in the repo — worth a separate dep bump pass if it causes issues.

### Commit Log

- `df3485b42` — "Update package.json to reflect version bump in wrangler." (pre-existing on branch, server-decorators 4.66.0 → 4.71.0)
- `5d91d221a` — "Merge remote-tracking branch 'origin/main' into vite-wrangler-updates" (merge + base-path 7.1.9→7.3.1, 4.42.0→4.71.0, lockfile update)
