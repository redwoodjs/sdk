# Work Log: 2025-09-25 - Resend Example and SSR Bridge Fixes

## Problem

Following recent work to support importing non-component exports from `"use client"` modules (see [#774](https://github.com/redwoodjs/sdk/pull/774)), integrating the `resend` playground example uncovered two subtle issues with the implementation.

1.  **Incorrect Proxying of Callable Components:** Some exports from `"use client"` modules, while intended to be called as functions from the server, also return JSX. This causes the runtime to correctly identify them as a React component (`isValidElementType`) but then incorrectly proxy them as a non-callable client reference. This prevents server-side code (like a Server Action) from executing them as functions. The RSC renderer expects a placeholder, but the server-side code expects a callable function.

2.  **Disruptive Re-optimization for SSR'd App Modules:** When a client module from the application's source code was imported into the `worker` via the SSR Bridge, Vite's dev server would trigger a re-optimization. As described in `docs/architecture/devServerDependencyOptimization.md`, this happens when the optimizer discovers a new dependency that wasn't included in its initial scan. In this case, the `ssr` environment's optimizer was not configured to scan the application's own client modules upfront. This re-optimization caused a worker reload, wiping module-level state and crashing the application.

## Solution

1.  **Update `registerClientReference` Logic:** The function was modified to handle this specific case. When it identifies an export as a valid React element type, it now also checks if the target is a function. If it is, it wraps the original SSR implementation in a new function. The special client reference properties (`$$id`, `$$async`, etc.) are then applied to this *wrapper*, not a generic stub. This makes the resulting proxy both callable on the server and correctly identified as a client reference by the RSC renderer.

2.  **Inform the SSR Optimizer of App Dependencies:** In `directiveModulesDevPlugin.mts`, the application's client barrel file (`APP_CLIENT_BARREL_PATH`) was added to the `optimizeDeps.entries` list for the `ssr` Vite environment. This ensures that when the dev server starts, Vite's `ssr` optimizer is made aware of all potential client modules within the application source code, preventing it from triggering a re-optimization when one is imported later via the SSR Bridge.

## PR Description

**Title:** `fix(ssr): Support server-callable components from client modules`

### Problem

Recent work ([#774](https://github.com/redwoodjs/sdk/pull/774)) introduced support for importing non-component exports from `"use client"` modules into the server environment. Integrating an example that relies on this for `@react-email/render` highlighted two edge cases.

First, a function exported from a `"use client"` module that also returns JSX was being treated exclusively as a client reference placeholder. This made it impossible to *call* the function from a Server Action, as the actual implementation was inaccessible in the `worker` environment.

Second, when such a module from the application's source was loaded into the `worker` via the SSR Bridge, it would trigger a Vite dependency re-optimization. The `ssr` environment's optimizer was not aware of the application's internal client modules upfront, causing a worker reload that wiped all module-level state.

### Solution

This change addresses both issues.

The `registerClientReference` runtime function is updated. When it encounters an export that is both a valid React component and a function, it now creates a proxy that is a callable function. This proxy wraps the original SSR implementation, allowing it to be executed from server code, while still having the necessary `$$` properties for the RSC renderer to treat it as a client reference.

The `directiveModulesDevPlugin` is updated to include the application's client barrel file in the `optimizeDeps.entries` for the `ssr` environment. This ensures Vite's dependency scanner is aware of all app-level client modules at startup, preventing disruptive re-optimizations during development.

These fixes unblock the `resend` playground example and make the SSR bridge more robust for complex use cases involving server-side utilities co-located with components in `"use client"` modules.
