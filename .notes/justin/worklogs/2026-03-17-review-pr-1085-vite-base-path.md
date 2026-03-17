# Review: PR #1085 — Vite Base Path Support

## Task Narrative

We are reviewing PR #1085 from zshannon, which adds support for Vite's `base` configuration option (e.g., `base: '/auth/'`) for running rwsdk apps behind a reverse proxy at a sub-path. The PR touches 9 files with 280 additions and 21 deletions. We are particularly concerned about one change in the core request handling flow (`worker.tsx`) given we just shipped 1.0. The PR author notes this is "all Claude Code slop" and offers it as a jumping-off point.

## Synthesized Context

- **Production Build Process** (`docs/architecture/productionBuildProcess.md`): The build is a 5-step pipeline (directive scan, worker pass, SSR, client, linker). The linker pass replaces `rwsdk_asset:` placeholders with final hashed paths from `manifest.json`. Asset paths flow through `normalizeModulePath`.
- **Worker Runtime** (`docs/architecture/workerScripts.md`): The worker's fetch handler has a special `/assets/` intercept that forwards to `env.ASSETS` (Cloudflare's asset binding). This was noted as a workaround with a `todo` to eliminate it.
- **Existing base-path fix on main**: Commit `36d601120` on main already fixed the linkerPlugin to respect `config.base` for asset placeholder linking. This creates a merge conflict with the PR's independent implementation of the same fix.

## Known Unknowns

1. Does `env.ASSETS.fetch(request)` (pass-through) work correctly for the default `base: '/'` case? The original code stripped `/assets/` from the pathname — was that necessary?
2. How does Cloudflare's ASSETS binding resolve URL paths to files? Does it map against the file structure in `assets.directory`?
3. The `vitePreamblePlugin` restructuring uses object spread + property override — does this break the virtual plugin's hook lifecycle?

---

## Investigation: Merge Conflicts

### What conflicts and why

Two files conflict when merging main into this branch:

**1. `sdk/src/vite/linkerPlugin.mts`** — Both branches independently implemented the same fix. Main's commit `36d601120 fix: Respect Vite base for linking asset placeholder` adds:
- `ResolvedConfig` type import
- `base?: string` optional parameter on `linkWorkerBundle`
- `configResolved` hook to capture `config.base`
- Asset path prefixed with base: `(base ? base : "/") + file`

The PR's version is nearly identical but with two differences:
- Uses `base: string` (required) instead of `base?: string` (optional)
- The deprefix logic differs: PR does `newCode.replaceAll("rwsdk_asset:", basePrefix)` (prepends base to remaining placeholders), while main does `newCode.replaceAll("rwsdk_asset:", "")` (strips prefix only, no base)

**Resolution**: Main's version is already merged. The PR's linkerPlugin changes are redundant. However, the PR's deprefix logic (step 3) is arguably more correct for the base-path case — remaining placeholders for public assets should also get the base prefix. Main's version strips the prefix but doesn't add base. This is a potential gap on main worth noting.

**2. `sdk/src/vite/buildApp.mts`** — Main added two features since the branch point:
- Plugin setup pass (PR #846) — adds a pre-scan build pass
- Configurable esbuild options (PR #1079) — threads `esbuildOptions` parameter

The PR adds a post-build nesting step (only active when `base !== "/"`). These are additive and touch different parts of the file, but the imports section overlaps. Straightforward to resolve.

---

## Investigation: The `/assets/` Handler Change (worker.tsx)

This is the most safety-critical change. Let's trace the data flow.

### Original code (on main)
```js
if (request.url.includes("/assets/")) {
  const url = new URL(request.url);
  url.pathname = url.pathname.slice("/assets/".length);
  return env.ASSETS.fetch(new Request(url.toString(), request));
}
```

For a request to `https://example.com/assets/main.abc123.js`:
- `url.pathname` = `/assets/main.abc123.js`
- `.slice("/assets/".length)` = `.slice(8)` = `main.abc123.js` (no leading slash)
- Fetches `env.ASSETS` with pathname `main.abc123.js`

### PR's simplified code
```js
if (request.url.includes("/assets/")) {
  return env.ASSETS.fetch(request);
}
```
Passes the original request through to `env.ASSETS` with pathname `/assets/main.abc123.js`.

### Analysis

**The PR author's claim is correct** that the old code breaks with a base prefix. For `https://example.com/auth/assets/main.js`:
- `.includes("/assets/")` matches (correct)
- `url.pathname` = `/auth/assets/main.js`
- `.slice(8)` = `ssets/main.js` (GARBAGE — slicing a fixed offset from the wrong position)

**However, the simplification changes behavior for `base: '/'` too.** The question is whether the old path-stripping was ever necessary.

**Evidence**: Cloudflare's ASSETS binding resolves URL paths against the deployed file structure. Vite outputs client assets to `dist/client/assets/`. The `wrangler.jsonc` template has `"assets": { "binding": "ASSETS" }` with no explicit `directory`. The Cloudflare Vite plugin manages the `assets.directory` at build time.

**Conjecture (flagged)**: The old path-stripping may have been written for an earlier version of the Cloudflare asset system, or it may have been a latent bug that never manifested because Cloudflare's platform serves static assets at the CDN layer before they reach the worker. The worker-level handler is a fallback (noted in the `todo` comment). If correct, the simplification is safe and was arguably always the intended behavior.

**Risk assessment**: This is a behavioral change in the core fetch handler that affects ALL rwsdk apps, not just those using `base`. If `env.ASSETS.fetch(request)` doesn't work for default apps, this is a P0 regression post-1.0.

**Recommendation**: We should NOT merge this change without empirical verification. We should:
1. Add a playground example that uses `base` to verify the fix
2. Confirm existing playground e2e tests still pass (they exercise the default `base: '/'` path)
3. Ideally test a production deploy to verify asset serving works

---

## Investigation: Other Changes

### `stripBase` helper (`sdk/src/lib/stripBase.mts`)
Clean, well-tested utility. 6 tests cover edge cases (empty base, `/` base, no-match, multi-level). No issues.

### `transformJsxScriptTagsPlugin.mts`
Uses `stripBase` to normalize entry points and asset paths before passing to `normalizeModulePath`. The logic is correct: when `base: '/auth/'`, Vite prefixes resolved paths with `/auth/`, so we need to strip it before normalizing. Captures `config.base` via `configResolved` following the existing `isBuild` pattern.

### `vitePreamblePlugin.mts`
Restructured to capture `config.base` and prefix `/@react-refresh` with the base path. The implementation uses object spread on `virtualPlugin()` result and then overrides `name`.

**Confirmed bug**: `virtualPlugin` returns a plain object with `name`, `resolveId`, and `load` hooks. The PR spreads this and then overrides `name` to `"rwsdk:vite-preamble"`, **clobbering** the original name `"rwsdk:virtual:virtual:vite-preamble"`. But worse, it adds a `configResolved` hook AFTER the spread — this means the spread captures `resolveId` and `load` correctly, and the added `configResolved` does work. However, the `name` override is cosmetic (doesn't break functionality). The real problem is that the `load` hook inside `virtualPlugin` captures `base` in closure at construction time (before `configResolved` runs), but actually re-reading the code: `virtualPlugin`'s `load` just delegates to the `load` argument passed in, which is the async function that reads `base` from the outer closure. Since `configResolved` sets `base` before any `load` call happens, this actually works correctly.

**Verdict**: The pattern is unconventional but functionally correct. The `name` override is harmless. However, it would be cleaner to wrap `virtualPlugin` rather than spread it.

### `buildApp.mts` — Post-build nesting
When `base !== "/"`, copies the entire `dist/client/` contents into a subdirectory matching the base (e.g., `dist/client/auth/`), then patches `wrangler.json`'s `assets.directory`. This is a valid approach for making Cloudflare's path-to-file mapping work with a sub-path, but:
- Uses synchronous `fs` APIs (`cpSync`, `rmSync`, `mkdirSync`) in an async function — inconsistent with the rest of the file which uses `node:fs/promises`
- The `wrangler.json` patching logic assumes the file exists at `dist/worker/wrangler.json` — this path may be generated by the Cloudflare Vite plugin and might not always be `wrangler.json` (could be `wrangler.jsonc` or `wrangler.toml`)
- The `directory` replacement logic (`currentDir.replace("/${subdir}", "")`) is brittle — it does a simple string replace which could match unintended substrings

### `linkerPlugin.test.mts` (new tests)
Added 2 tests for base-prefixed asset URLs. These are good but test the PR's version which is now redundant with main's.

### `transformJsxScriptTagsPlugin.test.mts` (new tests)
Added 4 tests for base-stripping behavior. These are valuable and test real scenarios (stripping base from script src, dynamic imports, link href).

---

## Summary of Review Findings

### Merge Conflicts
| File | Cause | Resolution |
|------|-------|------------|
| `linkerPlugin.mts` | Both branches independently fixed base-path support | Drop PR's linkerPlugin changes, keep main's. Consider backporting PR's deprefix improvement. |
| `buildApp.mts` | Main added plugin-setup pass + esbuild options | Mechanical merge of imports + new parameters. PR's nesting logic goes at end of function, no semantic conflict. |

### The `/assets/` handler (HIGH RISK)
- The old code is provably broken with base paths (slices at wrong offset)
- The simplification changes default behavior too
- **Must be verified empirically before merging** — suggest adding a playground e2e test

### Code Quality Issues
1. `vitePreamblePlugin.mts` — fragile object spread pattern over plugin result
2. `buildApp.mts` — sync fs APIs in async function, brittle wrangler.json patching
3. `linkerPlugin.mts` — fully redundant with main

### What's Good
- `stripBase` helper is clean and well-tested
- `transformJsxScriptTagsPlugin.mts` changes follow established patterns
- New tests are valuable, especially the `transformJsxScriptTagsCode` ones
- The overall approach (strip base at boundaries, use `configResolved` closures) is sound

### Recommendation
1. Rebase onto main, dropping linkerPlugin changes (already fixed on main)
2. Do NOT merge the worker.tsx change without e2e verification
3. Fix vitePreamblePlugin to not use fragile spread pattern
4. Consider making buildApp nesting logic more robust
5. Add a `base-path` playground example for ongoing regression testing

---

## RFC: Rebase, Clean Up, and Add E2E Coverage

### 2000ft View Narrative

We take the contributor's branch, rebase it onto main, resolve conflicts (dropping the now-redundant linkerPlugin changes), add a `base-path` playground example that exercises the asset-serving path with `base: '/app/'`, and use it to empirically verify the `/assets/` handler simplification. We also clean up code quality issues (sync fs, vitePreamblePlugin pattern).

### Behavior Spec

```gherkin
Scenario: Base path playground renders correctly
  Given a playground app with base: '/app/' in vite config
  When the page is loaded at the root URL
  Then the page content should contain "Hello World"
  And CSS styles should be applied (verifies asset loading)

Scenario: Default base path still works
  Given existing hello-world playground with default base: '/'
  When the page is loaded
  Then the page renders normally (existing test)
```

### Implementation Breakdown

1. `[NEW]` `playground/base-path/` — Minimal playground based on `hello-world`, with `base: '/app/'` in vite config
2. `[NEW]` `playground/base-path/__tests__/e2e.test.mts` — E2E test verifying page renders and assets load
3. `[MODIFY]` Rebase branch onto main — resolve buildApp.mts conflict, drop linkerPlugin changes
4. `[MODIFY]` `sdk/src/vite/vitePreamblePlugin.mts` — Replace spread pattern with cleaner wrapper
5. `[MODIFY]` `sdk/src/vite/buildApp.mts` — Switch sync fs to async, improve wrangler.json patching

### Tasks

- [x] Task 1: Create `playground/base-path/` example (clone hello-world, add `base: '/app/'`)
- [x] Task 2: Add e2e test for base-path playground
- [x] Task 3: Rebase onto main, resolve conflicts (dropped linkerPlugin commit, resolved buildApp imports)
- [x] Task 4: Clean up vitePreamblePlugin spread pattern
- [x] Task 5: Clean up buildApp.mts (async fs, robust wrangler patching)
- [x] Task 6: Run unit tests — all 457 tests pass (35 files)

## Implementation Notes

### Rebase
- Skipped commit `e1b44509a` (linkerPlugin changes) — already on main via `36d601120`
- Resolved `buildApp.mts` imports conflict by merging both sets (main's async + PR's sync, later converted all to async)
- Lockfile regenerated for new playground

### Commits (on rebased branch)
1. `67f307b02` feat: add stripBase helper for Vite base path support (zshannon)
2. `5c0c0db00` feat: thread base parameter through transformJsxScriptTags functions (zshannon)
3. `9bd41ef03` test: add base-stripping tests for transformJsxScriptTagsCode (zshannon)
4. `8ad9fd019` feat: add base-path support to vitePreamblePlugin (zshannon)
5. `560e3802a` feat: nest client output under base subdirectory for Cloudflare assets (zshannon)
6. `2d1eeb10d` fix: simplify /assets/ handler to support base path prefix (zshannon)
7. `23dc3cf8a` feat: add base-path playground example for e2e testing
8. `cbdc48e61` refactor: clean up base-path support code quality

### Remaining work
- [ ] Run e2e tests (base-path playground + hello-world) to verify asset serving
- [ ] Consider backporting the linkerPlugin deprefix improvement from the PR to main

## Investigation: Route Matching With Base Path

The e2e test for the base-path playground was failing with 404. Investigation revealed that the PR's changes only addressed asset paths, not route matching. When `base: '/app/'` is configured, the worker receives requests with `/app/` in the pathname, but routes are defined as `route("/", Home)`.

**Root cause**: The router extracts `url.pathname` from `request.url` at `router.ts:370`. With base `/app/`, the pathname is `/app/` but the route expects `/`.

**Fix**: Added base-path stripping in `worker.tsx`, before the router is called. Uses `import.meta.env.BASE_URL` (Vite built-in, injected at transform time). When the pathname starts with the base, we strip it and create a new Request.

**Important discovery**: The SDK's `dist/` output is what playgrounds use (via `package.json` exports), not the source. Changes to `sdk/src/runtime/worker.tsx` require `pnpm build` before they take effect in dev mode. The e2e harness handles this automatically.

**Verified locally**: After `pnpm build`, `curl http://localhost:5174/app/` returns 200 with "Hello from Base Path" in the HTML.

### Updated commits
9. `7c721cfeb` feat: strip Vite base path from request URL before routing
