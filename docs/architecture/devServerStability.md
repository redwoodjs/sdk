# Architecture: Dev Server Stability

## The Challenge: Unstable Server Renders on Re-optimization

Vite's dependency re-optimization is a core feature of its development server. When a new, previously undiscovered import is added to the codebase, Vite automatically pre-bundles it and reloads the browser to ensure a consistent state. This process is generally seamless for client-side code, as Vite's client script handles the `full-reload` Hot Module Replacement (HMR) event gracefully.

However, this standard recovery model does not apply to code executing on the server, specifically within our framework's `worker` environment. The "client" in this context is not a browser, but the Cloudflare `CustomModuleRunner` executing inside Miniflare. This server-side runner does not have the same built-in recovery logic as a browser.

When a re-optimization is triggered by a module used during a server-render (e.g., inside an SSR'd component or a server action), the system enters an unstable state. Without a robust recovery mechanism designed for this server-side context, this can lead to crashes, hangs, and a frustrating developer experience. The challenge, therefore, is to create a recovery system that makes re-optimization events as seamless for our server environment as they are for a browser.

## The Solution: A Server-Side Recovery System

To solve this, the framework implements a multi-layered system that creates a robust recovery process for the server environment. Building this system required overcoming several technical hurdles that arise from our use of two interconnected Vite environments (`worker` and `ssr`).

### Hurdle 1: Stale Resolution from Cached Module Nodes

Vite's module graph caches a representation of every processed module in a `ModuleNode` object. When a re-optimization occurs, Vite's standard invalidation process sets a flag on these nodes but does not fully remove them, leaving behind a "ghost node". This ghost node retains some old information, including the module's previously resolved ID (e.g., a path with an old version hash).

This creates a problem for our SSR Bridge. When the bridge requests a module by its clean, un-hashed name, Vite's resolver can find this ghost node and, as a shortcut, re-use its stale, version-hashed ID instead of performing a fresh resolution. This leads to a request for an outdated dependency.

**Solution:** The `ssrBridgePlugin` employs **Proactive Hash Resolution**. It avoids this faulty lookup by not relying on Vite's internal resolver for virtual modules. Instead, it proactively determines the correct, up-to-date version hash for any optimized dependency by looking directly at the SSR optimizer's metadata.

### Hurdle 2: Desynchronized Environment Caches

The `worker` and `ssr` environments are isolated; by default, an HMR event in one does not affect the other. This architectural separation becomes a problem during re-optimization. If the `ssr` environment re-optimizes and resets its state, the `worker` environment remains unaware, leaving its own caches (both Vite's module graph and the Cloudflare runner's execution cache) in a stale and inconsistent state.

**Solution:** The `ssrBridgePlugin` is responsible for **Cross-Environment HMR Propagation**. It bridges this gap by intercepting `full-reload` events from the SSR environment's HMR channel and forwarding them to the worker's channel. This ensures that when the `ssr` environment resets, the `worker` environment is also instructed to invalidate its caches in lockstep.

### Hurdle 3: Race Conditions on Re-import

The `CustomModuleRunner` is designed to re-import its entry points immediately after receiving a `full-reload` event. This happens too quickly, hitting the Vite server before it has finished stabilizing, which re-triggers a "stale pre-bundle" error. This necessitates a final safeguard that can gracefully handle this predictable race condition.

### The Debounced Redirect-and-Retry Mechanism

The solution is a final safeguard in the form of an error-handling middleware (`staleDepRetryPlugin`) that performs a **Debounced Retry**. When it catches the predictable "stale pre-bundle" error, it does not immediately retry. Instead, it waits for the server to become "stable" by monitoring Vite's `transform` hook for a period of inactivity.

Once the server is stable, it performs two actions:
1.  **Triggers a client-side reload:** A `full-reload` HMR message is sent to the browser.
2.  **Redirects the failed request:** It responds to the original request with a `307 Temporary Redirect`.

This redirect was chosen over a transparent, server-side retry for two key reasons:
1. **Technical Feasibility:** A transparent retry for requests with bodies (e.g., `POST` for server actions) is not possible without buffering the request body in advance, an approach that was rejected for performance and dev/prod parity reasons.
2. **Architectural Safety:** Transparently retrying `POST` requests is risky, as it could cause non-idempotent actions to execute twice.

The `307` redirect forces the client to re-issue the request against a now-stable server. This makes it a simple and universal recovery mechanism that handles all types of requests consistently, whether the original request was for a full HTML document (for pages with or without client-side JS), a `fetch` request from a client-side interaction, or a non-browser request from within the worker itself. While this can result in a "no op" result for the first click for client-side interactions (if reoptimization needed to happen when the interaction happened), its robustness and simplicity make it the most pragmatic choice.
