
## Validation of Limitations & Failure Cases

I validated your concerns regarding parallelism and the failure mode of the "Pure Plugin" approach.

### 1. Parallelism & "The Pool"
You asked: *"can only be sync this way unless we have a pool of dev servers"*
**Answer**: Specifically for `vitest-pool-workers`, parallel execution **is supported and safe**.
-   **Why**: The "Pool" in `vitest-pool-workers` explicitly manages a pool of isolated Miniflare instances.
-   **Isolation**: The README confirms it *"Implements isolated per-test storage"*. Each test file gets its own isolated context (including its own D1/KV storage state).
-   **The Bridge**: When a test calls `invoke()`, it hits the worker instance *assigned to that test context* (via `SELF`). It does not hit a single shared global worker.
-   **Conclusion**: We do *not* need to worry about sync-only execution. The pool handles the complexity of isolated parallel dev servers for us.

### 2. Failure of Pure Plugin in RWSDK
You asked: *"so itd likely fail in our frameworks case? because there wouldnt be env etc?"*
**Answer**: **Yes, absolutely.**
-   **The Reason**: RWSDK apps rely heavily on `env` (bindings) being available globally or passed to the handler.
-   **The Failure**: In the Pure Plugin's "Simulated Environment" (Browser Mode), there is no Cloudflare runtime. `env.DB`, `env.KV`, and `env.R2` simply do not exist.
-   **The Consequence**: Any code path that touches a binding would crash immediately with `ReferenceError` or `undefined`. You would have to mock *everything* (network, bindings, globals).
-   **Validation**: This confirms why the "Test-Bridge" pattern is the only viable path for integration testing where you want real behavior without strictly mocking the entire universe.

