# 2026-03-01: Stable Deploy Dynamic Import Skew Investigation

## Started worklog and captured context

We are investigating downstream reports of intermittent runtime failures: `Failed to fetch dynamically imported module`.

Scenario to reproduce in E2E:
1. A page stays open long enough for a deploy to happen.
2. A deploy happens while that tab is still on an older in-memory client runtime.
3. We resume via client-side navigation or interaction.
4. Dynamic module loading fails because runtime and hosted assets are skewed.

Task goal for this phase:
- Record context and an RFC plan.
- Perform evidence-based research in the codebase and docs.
- Record findings and stop before implementation.

## Per-task RNA synthesis from available docs

We checked for the expected task context sources:
- `docs/blueprints/`: not present in this worktree.
- `docs/learnings/`: not present in this worktree.
- `docs/architecture/`: present and used as source context.

Key docs reviewed:
- `docs/architecture/endToEndTesting.md`
- `docs/architecture/clientSideNavigation.md`

Context seed:
- The E2E system supports high-level runners and low-level lifecycle controls.
- Low-level `testSDK` is intended for cases that need explicit server/deploy lifecycle control.
- Client-side navigation keeps a long-lived runtime and fetches RSC payloads via GET on navigation, which is a plausible place for skew to surface.

## Investigation evidence for harness APIs

Evidence from referenced files:
- `playground/requestInfo/__tests__/e2e.test.mts:33` uses `testSDK.dev(...)`.
- `sdk/src/lib/e2e/testHarness.mts:361` defines `createDeployment()`.
- `sdk/src/lib/e2e/testHarness.mts:534-539` shows `SDKRunnerWithHelpers` includes `.deploy`.
- `sdk/src/lib/e2e/testHarness.mts:756-769` defines `testSDK.deploy(...)`.
- `sdk/src/lib/e2e/testHarness.mts:772` exports `testSDK`.

Behavior findings from harness code:
- `testSDK.deploy(...)` is available and suitable for deploy-focused low-level tests.
- `testSDK` callback context includes `browser`, `page`, and `projectDir` (not `url`), so deployment URL must come from `createDeployment().start()`.
- `createDeployment().start()` memoizes one deployment per control object; to redeploy in a single test, we can create a second control object.
- `setupPlaygroundEnvironment(...)` supports `dev` and `deploy` flags and `autoStartDevServer`, allowing deploy-only setup when needed.

## Investigation evidence for deployment identity and redeploy behavior

Evidence from `sdk/src/lib/e2e/release.mts:336-540`:
- `runRelease(...)` updates `wrangler.jsonc` name to the current isolated directory basename before deploy.
- `runRelease(...)` extracts deployment URL from CLI output and returns `{ url, workerName }`.

Inference from this evidence:
- Repeated deploy calls from the same isolated project directory likely update the same worker name, which is useful for deploy-skew simulation in one session.

## Investigation evidence for playground baseline state

We inspected local playground state:
- `playground/hello-world` exists.
- `playground/stable-deploy` exists as a local directory but has no tracked files (`git ls-files playground/stable-deploy` returns nothing).
- Current `playground/stable-deploy` contains only `node_modules/` as local residue.

Implication:
- A clean, reproducible `stable-deploy` example is not currently present as tracked source in this worktree state.

## Investigation evidence for dynamic import surface area

Evidence:
- In `playground/hello-world/src`, the only explicit dynamic import match is bootstrap script import in `Document.tsx`: `import("/src/client.tsx")`.
- We did not observe additional explicit lazy/dynamic client boundaries in current hello-world source.

Finding:
- A straight hello-world copy may be too minimal for deterministic reproduction of client-side dynamic chunk fetch skew unless we add an explicit dynamic client module loading path.

## Ideation notes for repro design

We considered the minimum viable repro shape:
1. Deploy v1 and open page.
2. Trigger deploy v2 from same test run.
3. Without full reload, trigger client-side behavior that causes dynamic module fetch.
4. Assert whether fetch fails with the reported runtime signature.

We should keep the first version intentionally narrow and deterministic:
- Prefer explicit dynamic import trigger points.
- Capture `pageerror`, console errors, and failed request diagnostics.
- Avoid HMR assumptions; this is deploy runtime behavior.

## Draft RFC for next phase

### 2000ft view narrative

We will create a dedicated stable-deploy E2E scenario that keeps one browser page alive across a redeploy and then exercises client-side dynamic loading. The test will confirm whether deploy skew reproduces as a dynamic import fetch failure and will become a regression harness for future fixes.

### Database changes

No database changes.

### Behavior spec (GIVEN/WHEN/THEN)

1. GIVEN an initial deployment and an open hydrated page,
WHEN we verify baseline rendering,
THEN the app is healthy.

2. GIVEN that same page remains open,
WHEN we execute a second deployment,
THEN server-hosted assets/runtime are updated while page memory remains on the initial runtime.

3. GIVEN this skewed state,
WHEN we perform client-side navigation/action that requires dynamic module loading,
THEN we record whether dynamic import requests succeed or fail, including the reported error signature.

### API reference (planned)

- `setupPlaygroundEnvironment({ sourceProjectDir: import.meta.url, dev: false, deploy: true, autoStartDevServer: false })`
- `testSDK.deploy(...)`
- `createDeployment().start()` for first deploy and redeploy
- Puppeteer `page.on("console")`, `page.on("pageerror")`, and network listeners

### Implementation breakdown

- `[NEW/MODIFY]` Create tracked `playground/stable-deploy` example from `hello-world` baseline.
- `[MODIFY]` Add deploy-skew E2E using low-level deployment lifecycle APIs.
- `[MODIFY]` Add deterministic dynamic-loading trigger and assertions.

### Directory and file structure (planned)

- `playground/stable-deploy/**`
- `playground/stable-deploy/__tests__/e2e.test.mts`

### Types and data structures

No schema/type-system changes expected.

### Invariants and constraints

- Repro must not depend on dev-only HMR behavior.
- Repro should keep one tab alive across redeploy to preserve in-memory old runtime.
- Assertions must be evidence-driven (captured console/page/network signals).

### System flow delta

Previous flow:
- Hello-world tests verify render on one deployment lifecycle.

Proposed flow:
- Deploy v1 -> open page -> redeploy v2 -> client-side action in same tab -> observe dynamic import behavior under skew.

### Suggested verification for implementation phase

- `pnpm test:e2e playground/stable-deploy/__tests__/e2e.test.mts`
- Optional deploy-only focus: `RWSDK_SKIP_DEV=1 pnpm test:e2e playground/stable-deploy/__tests__/e2e.test.mts`

### Tasks

- [ ] Create tracked `stable-deploy` playground baseline.
- [ ] Implement low-level deploy+redeploy E2E flow.
- [ ] Add dynamic-load trigger and error instrumentation.
- [ ] Calibrate assertions and flake resistance.

## Findings summary

1. `testSDK.deploy` and `createDeployment` are available and suitable for this investigation.
2. Deploy URL management for low-level tests comes from `createDeployment().start()`, not from `testSDK` callback context.
3. Redeploy in one test should be feasible by creating a second deployment control object.
4. `playground/stable-deploy` is not currently tracked in this worktree state; we only have local `node_modules/` residue there.
5. `hello-world` currently has minimal dynamic import surface beyond bootstrap import, so additional dynamic-loading surface likely needs to be introduced for deterministic skew reproduction.
6. This phase completed context capture, investigation, and RFC drafting only. No implementation was performed.

## Implemented stable-deploy playground baseline from hello-world

We created a tracked `playground/stable-deploy` baseline by copying `playground/hello-world` source files (excluding dependency lock-in behavior changes). We also updated `playground/stable-deploy/package.json` package name to `stable-deploy`.

## Implemented explicit dynamic-import trigger surface

To make deploy-skew behavior observable in a deterministic way, we added a client-side lazy import boundary:
- `src/app/components/LazyModuleTrigger.tsx` (`"use client"`) with `React.lazy(() => import("./RedeployLazyMessage"))`
- `src/app/components/RedeployLazyMessage.tsx`
- `src/app/pages/Home.tsx` now renders `<LazyModuleTrigger />`

This allows us to defer loading a client chunk until after redeploy, which is the critical skew point we need to test.

## Implemented low-level deploy/redeploy E2E flow

We replaced the basic stable-deploy E2E test with a low-level deploy-skew scenario in `playground/stable-deploy/__tests__/e2e.test.mts`:
1. Deploy once with `createDeployment().start()`.
2. Open page and confirm baseline content.
3. Deploy again in the same test (new deployment control).
4. Keep existing tab alive, trigger client-side navigation via `pushState` + `popstate`.
5. Trigger lazy dynamic import by clicking `Load Lazy Message`.
6. Assert lazy content renders and no captured error includes `Failed to fetch dynamically imported module`.

Instrumentation added:
- `pageerror` capture
- console error capture
- failed request capture

## Verification status

We intentionally did not run automated tests in this phase.

Manual verification commands proposed for next step:
- `pnpm test:e2e playground/stable-deploy/__tests__/e2e.test.mts`
- Optional deploy-only focus: `RWSDK_SKIP_DEV=1 pnpm test:e2e playground/stable-deploy/__tests__/e2e.test.mts`

## Recorded manual reproduction when deploy E2E was blocked

We could not run deployment E2E because of an unrelated account issue that currently prevents deploys. We reproduced the same failure mode manually using local production preview:

1. `pnpm build`
2. `pnpm preview`
3. Open app in browser
4. Make a component change
5. `pnpm build` again
6. Interact on the already-open page/tab

Observed runtime error in browser:
- `TypeError: Failed to fetch dynamically imported module: http://localhost:4173/assets/RedeployLazyMessage-B6MdoznR.js`
- Component stack includes `Lazy` / `Suspense` / `LazyModuleTrigger`

Interpretation from this repro:
- The issue reproduces without Cloudflare deploys and appears to match deploy-skew semantics: the long-lived page runtime references a previously built hashed chunk that no longer exists after rebuild.
- This aligns with the current production build behavior where output assets are cleared between builds.

Current solution direction (hypothesis):
- Avoid deleting previous client assets on each deploy/build so older in-memory runtimes can still fetch their versioned dynamic chunks during transition windows.
- We should validate storage/caching implications and rollout constraints before implementation.
