# 2026-01-20 Investigate Vitest Support

## Validation of Limitations & Failure Cases

We validated concerns regarding parallelism and the failure mode of the "Pure Plugin" approach.

### 1. Parallelism & "The Pool"
**Concern**: Does the bridge pattern limit us to synchronous execution?
**Findings**: No. Specifically for `vitest-pool-workers`, parallel execution **is supported and safe**.
-   **Why**: The "Pool" explicitly manages a pool of isolated Miniflare instances.
-   **Isolation**: It implements isolated per-test storage. Each test file gets its own isolated context (including its own D1/KV storage state).
-   **The Bridge**: When a test calls `invoke()`, it hits the worker instance *assigned to that test context* (via `SELF`). It does not hit a single shared global worker.
-   **Conclusion**: We do *not* need to worry about sync-only execution. The pool handles the complexity of isolated parallel dev servers for us.

### 2. Failure of Pure Plugin in RWSDK
**Concern**: Would the Pure Plugin approach fail for RWSDK due to missing environment bindings?
**Findings**: **Yes, absolutely.**
-   **The Reason**: RWSDK apps rely heavily on `env` (bindings) being available globally or passed to the handler.
-   **The Failure**: In the Pure Plugin's "Simulated Environment" (Browser Mode), there is no Cloudflare runtime. `env.DB`, `env.KV`, and `env.R2` simply do not exist.
-   **The Consequence**: Any code path that touches a binding would crash immediately with `ReferenceError` or `undefined`. We would have to mock *everything* (network, bindings, globals).
-   **Validation**: This confirms why the "Test-Bridge" pattern is the only viable path for integration testing where we want real behavior without strictly mocking the entire universe.

## Summary for Discord ("The Lay of the Land")

**The Two Approaches**

**1. Pure Plugin (Jont's suggestion)**
*   **How we understand it**: Runs tests in a Browser runner (Playwright) and *simulates* the RSC environment in-process.
*   **Pros**: Good for UI component testing. Simple setup (no extra routing).
*   **Limitations**:
    *   **Fails for RWSDK apps**: The simulated environment has no Cloudflare runtime. `env.DB`, `env.KV` are undefined. Any backend code crashes.
    *   **Scope**: Only tests components, not backend logic.

**2. Test-Bridge (Herman's PR / Showcase)**
*   **How we understand it**: Runs tests in the **Worker Pool** (`vitest-pool-workers`). Requires a `/_test` route in our worker. Tests act as a client and "bridge" calls to the worker via HTTP.
*   **Pros**:
    *   **Real Integration**: Runs in the actual Miniflare environment. D1/KV/Queues work natively.
    *   **Parallelism is Safe**: The "Pool" spins up an isolated Miniflare instance per test file, so we *do* have parallel execution.
*   **Limitations**:
    *   **Mocking**: Since we bridge to a "real" worker instance (black box), we can't easily mock internal modules (like `vi.mock`). We rely on real integration behavior.
    *   **Architecture**: High complexity. Users need to copy-paste the bridge code and expose a `/_test` route.

**The Options (Ways Forward)**

*   **Option A: Ship the "Test-Bridge" (Experimental)**
    *   We wrap the bridge logic in the SDK (experimental API) so users don't have to copy-paste it.
    *   *Result*: Users get working integration tests NOW.
    *   *Risk*: High effort to productize, and the architecture might be obsolete when "Native Support" lands.

*   **Option B: Wait for Native Support (Recommended)**
    *   `workers-sdk` is actively overhauling testing for Vitest 4 support. This should solve the underlying "SSR vs RSC" conflict and race conditions.
    *   *Result*: We don't ship "throwaway" architecture. We wait to do it properly.
    *   *Risk*: Users have no solution in the interim (except using Playwright against `dev`).

*   **Option C: Pure Plugin (Not Recommended)**
    *   Shipping JonT's approach nicely wrapped.
    *   *Why not*: It just crashes for any real RWSDK app usage (lack of `env`). It's a footgun.

**Our Take**: The "Test-Bridge" is the only thing that *works* for backend testing right now, but it's heavy. Waiting might be the smarter play if the overhaul is close.

## Deep Dive: The Bridge Mechanism

**Key Question**: *"There is a bridge. What's at either end?"* and *"Why do we have that pools layer in between?"*

### The Architecture: It's a Loopback (Self-Request)

Contrary to the idea of "Talk to a separate server," the Bridge pattern in `vitest-pool-workers` is actually a **Loopback Mechanism**.

*   **Side A (The Caller)**: Our test code. It runs **inside** the Worker Isolate (managed by the Pool).
*   **Side B (The Receiver)**: Our Application code (the `fetch` handler). It runs **inside the exact same Worker Isolate**.

When we call `SELF.fetch("http://localhost/_test")`:
1.  The request does **not** leave the Isolate to go to some external dev server.
2.  It loops back into the *entry point* of the current isolate.
3.  It triggers the `fetch` handler defined in `worker.tsx`.

### Why the Bridge? (Why not just call functions?)

If we are in the same isolate, why `fetch`? Why not just import `myAction` and call it?

**Reason: The Request Lifecycle & Context**
RedwoodSDK (and RSCs in general) relies heavily on **AsyncLocalStorage** and **Request Context**.
*   When a real request comes in, the server sets up `RSCContext`, `StorageContext`, `RouterContext`.
*   If we just call `myAction()` from a test, **none of that context exists**. The action would crash accessing `ctx`.
*   **The Bridge's Job**: By making a "fake" fetch request to ourselves (`/_test`), we force the application to run its full **entry pipeline**. It sets up the context, routers, and storage, *then* executes the action, and returns the result.

### Reconciling Parallelism

*   **Question**: *"Are we setting up a dev instance per pools worker?"*
*   **Answer**: **Yes.** That is exactly what `vitest-pool-workers` does.
    *   Test File A -> Isolate A (Miniflare Instance A) -> `SELF` refers to Instance A.
    *   Test File B -> Isolate B (Miniflare Instance B) -> `SELF` refers to Instance B.
*   **Safety**: Since `SELF.fetch` stays within the isolate, Test A triggers the pipeline in Isolate A. It never crosses over to Isolate B. Parallelism is perfectly safe.

## Architecture Synthesis ("The State of the Union")

We synthesized our thoughts on the architecture and landed on several critical realizations.

### 1. The "Built Worker" Requirement
**Realization**: To get this working *now* (without the Cloudflare/Vite race condition), we rely on pointing `vitest-pool-workers` to the **built worker** (`./dist/worker/wrangler.json`).
*   **Why**: This bypasses the need for the `vite-plugin-cloudflare` to run in the test process. We just hand the pool a "cooked" script.
*   **Implication**: This effectively bifurcates the workflow. `build` -> `test`. It's not a true "dev" cycle.

### 2. The Bridge Pattern is Permanent
**Realization**: Even after the `workers-sdk` overhaul lands and we get "native" support, we will *still* need the Bridge Pattern (or something very similar).
*   **Why**: **Context**. Merely importing `defineApp` in a test isn't enough. We need the `AsyncLocalStorage`, Router Context, and Storage Context that are only initialized during the REQUEST pipeline.
*   **Conclusion**: Integration tests for RWSDK will always need to "Enter via the Front Door" (a request) to ensure the environment is valid.

### 3. Mocking is the Main Casualty
**Realization**: Because we are hitting a "Built Worker" via a bridge, it is a **Black Box**.
*   **Problem**: We cannot use `vi.mock()` in the test file to mock a module *inside* the worker. They are different bundles running in different scopes.
*   **Result**: This confirms the Bridge Pattern is strictly for **Integration Testing** (Real inputs -> Real DB effects). It is not for unit testing with mocks.

### 4. Is `vitest-plugin-rsc` redundant here?
**Realization**: If we are testing a *built worker* where transforms are already done, and our test files just call `fetch`, the plugin is technically superfluous for *those specific tests*.
*   **Why it's there**: Probably for mixed repos or shared utils. But strictly speaking, the Bridge Driver (Test) doesn't need to know about RSCs if it's just sending JSON over HTTP.

### Final Verdict: The "Pragmatic Path"
The **Test-Bridge with Built Worker** is the only stable path today.
*   It bypasses the tooling incompatibility (Race Condition).
*   It respects the Architectural constraint (Need Request Context).
*   It accepts the limitation (No internal mocking).

## Final Investigation Findings

Following deep experimentation, we have arrived at the definitive "State of the Union" for Vitest support in RedwoodSDK (Pre-Overhaul).

### 1. The "Dev Server" Approach is a Dead End (For Now)
We attempted to run tests against the source code (using `vitest-pool-workers`' dev mode). This failed repeatedly due to conflicting environment requirements:
1.  **Initial Error**: `RedwoodSDK: 'react-server' import condition needs to be used`.
2.  **The Fix (Hack)**: We patched Vitest's `ssr.resolve.conditions` to include `react-server`.
3.  **The New Error**: `RedwoodSDK: A client-only module was incorrectly resolved with the 'react-server' condition`.
    *   *Analysis*: By forcing `react-server` into the generic "SSR" environment, we broke client-side imports that *shouldn't* have that condition. It is a game of whack-a-mole because `vitest-pool-workers` (currently) forces everything into a single "SSR" bucket.
    *   *Conclusion*: We cannot get native source-based testing working until the `workers-sdk` overhaul (Vitest 4+) enables proper custom environments.

### 2. The "Built Worker" Requirement
To bypass the environment/transform issues, we **must** point the pool to the **built worker**:
*   **Config**: `poolOptions.workers.wrangler.configPath = "./dist/worker/wrangler.json"`
*   **Why**: The build process (Vite/Rollup) correctly handles all RSC transforms and conditions *before* Vitest enters the picture. Vitest simply treats the result as a black-box script.
*   **Verdict**: This is the only stable configuration for now.

### 3. The Bridge Pattern is Permanent Architecture
We realized that the Bridge Pattern (`invoke` -> `SELF.fetch` -> `/_test`) is not just a workaround—it is likely the correct long-term architecture for RSC integration testing.
*   **Reason**: **Context**. We cannot simply import a Component or Action into a test file and run it. It requires `AsyncLocalStorage` (Storage, Router, Request Context) that is only initialized during the Request Pipeline.
*   **The Bridge**: Entering via `SELF.fetch` forces the application to run the full entry pipeline, setting up the necessary context before executing the code.
*   **Redundancy**: In this "Built Worker" mode, `vitest-plugin-rsc` is technically redundant for the test runner itself (since transforms are already done), though we might keep it for type consistency.

### 4. Summary of the Path Forward
1.  **Architecture**: **Test-Bridge Pattern** (running against **Built Worker**).
2.  **API**: We will eventually expose the `invoke` / `handleTestRequest` helpers as part of the SDK (e.g., `rwsdk/testing`).
3.  **Limitation**: No mocking of internal modules (Black Box testing).
4.  **Future**: When "First Class" support lands (Vitest 4), we may switch the backend from "Built Worker" to "Dev Server," but the **Bridge Architecture** (using `invoke` to trigger methods in-context) will likely remain the primary way to test backend logic.
