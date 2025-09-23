# Work Log: 2025-09-22 - Bridging Client Components for SSR

## Problem

When a module containing a `"use client"` directive is processed in the `worker` (RSC) environment, its implementation is replaced entirely with client reference proxies. This is the correct behavior for the RSC rendering pass, which only needs to serialize a reference to the client component.

However, this creates a problem for the subsequent SSR pass. The SSR renderer, which is responsible for generating the initial HTML, also runs within the `worker` environment but operates on the RSC payload. It needs access to the *actual* component implementation to render it, but that implementation has been stripped out. This leaves the SSR pass unable to render client components, resulting in incomplete HTML.

## Idea

The proposed solution is to create a bridge that provides the SSR renderer with the necessary component code without disrupting the RSC module graph. This involves modifying the client component transformation process.

When a client component is transformed for the `worker` environment, the process will be updated:

1.  In addition to generating the client reference proxies, inject an import for an SSR-processed version of the same component module. This import will use the SSR Bridge's virtual module prefix (`virtual:rwsdk:ssr:/path/to/component`). This effectively loads the component's code as processed by the `ssr` Vite environment.
2.  Update the `registerClientReference` factory function to accept the imported SSR component module as an argument.
3.  The runtime can then associate the SSR component implementation with its corresponding client reference. During the SSR pass, it can retrieve and render the actual component instead of the proxy.

This approach connects the two environments at the module level, ensuring the SSR renderer has what it needs while maintaining a clean separation for the RSC pass.

## Implementation Plan

1.  **Update `transformClientComponents.mts`:**
    -   Modify the transform to inject a namespace import for the SSR version of the client component module, e.g., `import * as SSRModule from 'virtual:rwsdk:ssr:/path/to/component.tsx'`.
    -   Update the calls to `registerClientReference` to pass this `SSRModule` as a new argument. The `exportName` will be used to access the correct export from `SSRModule`.

2.  **Update `registerClientReference`:**
    -   Locate its definition in `sdk/src/runtime/register/worker.ts`.
    -   Modify its signature to accept the imported SSR module namespace (`SSRModule`) as the first argument.
    -   Update the implementation to extract the specific export from the `SSRModule` (e.g., `SSRModule[exportName]`). This exported value (the actual component) is then passed to `baseRegisterClientReference`. This ensures that the client reference proxy is created around the actual SSR component implementation.

3.  **Update SSR Runtime:**
    -   Verify that the existing SSR `renderToReadableStream` process correctly handles the updated client references. With the `SSRModule` passed to `baseRegisterClientReference`, React's internals should handle the component resolution automatically, likely requiring no changes to our SSR runtime code.

4.  **Update Tests:**
    -   Modify the tests in `transformClientComponents.test.mts` to reflect the new output of the transformation.
    -   If possible, add a test case to verify that the SSR runtime correctly renders the bridged component. This might require an end-to-end test.

## Validation via Playground Example

To confirm the SSR bridging works for all exports from a "use client" module (not just components), a playground example will be set up to test two scenarios: a local client module and a client module from a package.

The core of the test is to import a non-component export (e.g., an object with methods) from a "use client" module into a Server Component and execute it during the server render.

### Plan

1.  **Set up a "use client" Module (In-App):**
    -   Create a file at `src/app/lib/client-utils.ts`.
    -   This file will contain the `"use client"` directive.
    -   It will export a simple object with a method, e.g., `export const clientObject = { format: (name) => ... }`.
    -   It will also export a React component, `<ClientButton>`, to ensure components still work.

2.  **Set up a "use client" Module (Package):**
    -   Re-create the `packages/ui-lib` directory to act as a local package.
    -   Its `index.tsx` will contain `"use client"` and export both a component (`<PackageButton>`) and a utility object (`packageObject`).
    -   Add `"ui-lib": "file:./packages/ui-lib"` back to the playground's `package.json`.

3.  **Integrate and Test in a Server Component:**
    -   Modify `Home.tsx` (a Server Component) to import from both the local `client-utils.ts` and the `ui-lib` package.
    -   On the server, call the methods from both `clientObject` and `packageObject` and render their string output directly into the page.
    -   Render both `<ClientButton>` and `<PackageButton>` to ensure they are interactive.

4.  **Add End-to-End Tests:**
    -   Update `e2e.test.mts` with two test suites.
    -   **Test 1 (Active):** Verify the local module case. Assert that the server-rendered HTML contains the string output from `clientObject.format()`. Assert that `<ClientButton>` is rendered and interactive.
    -   **Test 2 (Skipped):** Verify the package module case. This test will be marked as `.skip` for now. It will contain assertions for the output of `packageObject.format()` and the interactivity of `<PackageButton>`.

### E2E Test Debugging Notes

#### The `$$id` Redefinition Error

While running the e2e tests, a recurring error crashed the Vite dev server: `TypeError: Cannot redefine property: $$id`. This error originated from within the `registerClientReference` function.

**Discovery:**
Thanks to the `unifiedScriptDiscovery.md` architecture document, the cause became clear. The `$$id` property is a special identifier used by React's server renderer to locate client components. Our `registerClientReference` function intercepts the *getter* for this property to track which client components are being used on a page. The "Cannot redefine property" error occurs when `Object.defineProperties` is called on an object that *already has this getter defined*, which is not allowed for non-configurable properties.

**Root Cause:**
This pointed to a double-transformation problem in the Vite build pipeline. A "use client" module was being processed twice:
1.  First, during the initial RSC pass in the `worker` environment, our `transformClientComponents` plugin would correctly turn it into a client reference proxy with the `$$id` getter.
2.  Second, when the SSR renderer requested the component's source via the SSR Bridge (`virtual:rwsdk:ssr:...`), the source code was passed from the `ssr` environment back to the `worker` environment. The `worker` environment's plugin chain would then incorrectly process this *already-proxied* module a second time, triggering the error.

**Solution:**
The fix was to add a guard at the top of the `transformClientComponents` function. This guard checks if the module ID starts with the `virtual:rwsdk:ssr:` prefix. If it does, the transformation is skipped, preventing the double-processing and resolving the `$$id` redefinition error.

### Using a Proxy for Transparent Interception (The $$id Problem, Take 2)

**Problem:**
After fixing the double-transformation, a new conceptual issue arose. The `registerClientReference` function was attempting to use `Object.defineProperties` to add a getter for `$$id` directly onto the `target` component/object imported from the SSR module. This is problematic because `target` is a real module export, and we should avoid mutating it directly. More importantly, if `target` is a React component, it may already have framework-specific properties (like `$$id` from React's internals) that we should not overwrite.

**Solution using a Proxy:**
The new approach is to use a `Proxy` to create a transparent wrapper around the `target` object. This avoids mutation and allows for precise interception.

1.  **Create a Proxy:** Instead of defining properties on the `target`, `registerClientReference` will return a `new Proxy(target, handler)`.

2.  **Implement a `get` Trap:** The handler will contain a `get` trap to intercept property access.
    -   If `prop` is `$$id`:
        -   Perform the side effect: add the module `id` to `requestInfo.rw.scriptsToBeLoaded`.
        -   Return the *original* `$$id` value by reflecting the access to the `target` (`Reflect.get(target, prop)`).
    -   If `prop` is `$$async` or `$$isClientReference`:
        -   Return `true`. These properties signal to the renderer what kind of object it's dealing with, and they can be handled by the proxy itself without being on the target.
    -   For any other `prop`:
        -   Simply forward the access to the original `target` using `Reflect.get`.

This strategy is much cleaner. It preserves the integrity of the original component/object from the SSR module while still allowing us to spy on the `$$id` access for script discovery. The proxy is completely transparent for all other property accesses.
