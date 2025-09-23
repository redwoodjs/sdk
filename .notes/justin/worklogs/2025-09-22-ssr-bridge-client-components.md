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

### Final Approach: Combining the Reference with the Target

**Problem:**
The Proxy approach was flawed. It returned a proxy that wrapped the original component, but it *discarded* the special client reference object created by `baseRegisterClientReference`. React's renderer didn't recognize the proxy as a valid client reference, leading it to try and render the component's code during the RSC pass, which resulted in "Invalid hook call" errors.

**Solution:**
The correct solution is to merge the properties of the React client reference onto the target component/object from the SSR module. This gives React the special `$$` properties it needs, while still providing the actual implementation for the SSR pass.

1.  **Get the Target:** Get the actual export (`target`) from the `ssrModule`.
2.  **Create the Reference:** Call `baseRegisterClientReference(target, id, exportName)` to create the proxy-like object that React expects (`reference`).
3.  **Get Descriptors:** Use `Object.getOwnPropertyDescriptors(reference)` to get all the special properties (`$$id`, `$$async`, etc.) from the reference object.
4.  **Intercept `$$id`:** Find the descriptor for `$$id`. Create a new getter function for it that first performs our side effect (`requestInfo.rw.scriptsToBeLoaded.add(id)`) and then returns the original value. This re-implements our script discovery mechanism.
5.  **Apply to Target:** Use `Object.defineProperties(target, finalDescriptors)` to apply the (modified) special properties from the reference directly onto the `target`.

This returns the original `target` object, now enhanced with the properties that identify it as a client reference to the RSC renderer, and with our script-discovery hook attached. This should be the correct and final implementation.

### The Definitive Approach: A Proxy that Merges Two Worlds

**Problem:**
The "Combining the Reference with the Target" approach had a major flaw: it mutated the `target` object by adding properties to it. This is unsafe and can lead to unexpected side effects, especially if the `target` is a shared module export. The "Invalid hook call" error was a symptom of this incorrect handling.

**Solution: The Hybrid Proxy**
This final approach uses a Proxy to create a virtual object that combines the `target` and the `reference` without mutating either. It's the cleanest and most correct solution.

1.  **Get the Target:** Get the actual export (`target`) from the `ssrModule`.
2.  **Create the Reference:** Call `baseRegisterClientReference(target, id, exportName)` to get the special object (`reference`) that React's renderer needs.
3.  **Return a Proxy:** The function will return `new Proxy(target, handler)`.
4.  **Implement the `get` Trap:** The proxy's `get` trap will act as a smart switch:
    -   If the requested property `prop` starts with `$$`:
        -   If `prop` is `$$id`, first perform the script discovery side effect: `requestInfo.rw.scriptsToBeLoaded.add(id)`.
        -   Then, for any `$$` property, retrieve and return the value from the `reference` object (`Reflect.get(reference, prop)`). This ensures React's renderer gets the special properties it expects.
    -   For any other property, retrieve and return the value from the `target` object (`Reflect.get(target, prop)`). This ensures the rest of the application interacts with the real component/object.

This provides the perfect abstraction. The returned object behaves like the real SSR component for all normal interactions but presents the necessary client reference interface to the React RSC renderer, all without any mutation.

### Final Approach (Take 2): Conditional Registration

**Problem:**
The hybrid proxy, while clever, was still trying to merge two concepts (a client reference and a real object) that have different requirements. The "Invalid hook call" error persisted, indicating that even with the proxy, React was not correctly interpreting the object as a client reference placeholder during the RSC render.

**Solution: Treat Components and Non-Components Differently**
The definitive solution is to handle React components and other exports from a "use client" module with completely separate logic.

1.  **Dependency:** Add the `react-is` package to the SDK to reliably identify React component types at runtime.

2.  **Conditional Logic in `registerClientReference`:**
    -   Get the `target` export from the `ssrModule`.
    -   Use `react-is` (e.g., `isValidElementType`) to check if `target` is a React component.
    -   **If it IS a component:**
        -   Create the client reference by calling `baseRegisterClientReference(target, id, exportName)`.
        -   Return this `reference` directly. This is the special object React expects for components, and we will *not* add our script-discovery hook for now to simplify and isolate the problem.
    -   **If it is NOT a component (e.g., a utility object):**
        -   Return the `target` object directly, without creating a client reference. This allows it to be used as a normal object on the server during the SSR pass.

This approach is much simpler. It avoids proxies and property merging entirely, instead giving the React renderer exactly what it expects for components, and giving the server runtime exactly what it expects for everything else.

### Final Approach (Take 3): Conditional Logic with Original Implementation

**Rationale:**
The previous approach of calling `baseRegisterClientReference(target, ...)` for components and returning `target` for non-components was a step in the right direction. However, by passing the actual `target` to `baseRegisterClientReference`, we were creating a reference that React would try to render on the server, leading to "Invalid hook call" errors. The key insight is that for the RSC pass, React should *never* receive the actual component implementation, only an empty placeholder that it can serialize.

**Solution:**
This approach combines the new conditional logic with the original, battle-tested implementation from the `main` branch.

1.  **Conditional Logic:** Use `react-is` to check if the `target` is a `isValidElementType`.
2.  **If it IS a component:**
    -   Call `baseRegisterClientReference({}, id, exportName)`. Note the empty object (`{}`). This creates the placeholder reference that the RSC renderer expects.
    -   Take the descriptors from this reference.
    -   Intercept the `$$id` getter. The descriptor for `$$id` from React is a *data descriptor* (`{value, writable, ...}`). To add a getter, we must convert it to an *accessor descriptor*. This involves creating a new descriptor object that only contains `enumerable`, `configurable`, and our custom `get` function. Spreading the original descriptor would illegally combine `value` and `get`.
    -   Use `Object.defineProperties` to apply these special properties to an empty function `() => null`. This becomes the final client reference proxy.
3.  **If it is NOT a component:**
    -   Return the `target` object directly. It can be used as a plain object during the SSR pass.

This should be the correct and final logic. It ensures components are treated as serializable references by the RSC renderer, while allowing non-components to be used directly on the server.

---

## Documentation and Test Cleanup

With the implementation now stable, the final step is to create the architecture document explaining the transformation process and to ensure the unit tests are aligned.

### Plan

1.  **Create New Architecture Document (`directiveTransforms.md`):**
    -   Create a new document at `docs/architecture/directiveTransforms.md`.
    -   Structure the document using the established "Challenge/Solution" narrative format.
    -   Explain the dual requirements for both `"use client"` and `"use server"` modules in our hybrid environment.
    -   Detail the transformation logic for each Vite environment (`worker`, `ssr`, `client`), including commented code examples.
    -   Specifically explain how the SSR Bridge allows server-side code to import and use non-component exports from client modules during the SSR pass.

2.  **Update `transformClientComponents.test.mts`:**
    -   Review and confirm that all test cases in `sdk/src/vite/transformClientComponents.test.mts` match the final transformation logic.

---

## PR Description

**Title:** `feat(ssr): Support non-component imports from "use client" modules`

### Problem

In our hybrid RSC/SSR rendering model, modules marked with `"use client"` presented a challenge for non-component exports.

The `worker` environment, responsible for both RSC and SSR, would transform a `"use client"` module into a set of client reference proxies. This is correct for the RSC pass, but it created a problem for any other server-side code. If any logic in the `worker` needed to import a non-component export (e.g., a utility function, a constant, or a library-specific object) from that same client module, it couldn't. The actual implementation was completely replaced by the proxy, making the export inaccessible to any server-side logic.

This limited the utility of client modules and was a significant blocker for complex component libraries like Chakra UI, which co-locate components and utility objects in the same client modules.

### Solution

This change introduces a mechanism to bridge this gap, allowing non-component exports from `"use client"` modules to be correctly resolved and used within the `worker` environment during the SSR pass.

The solution has two main parts:

1.  **Build-Time Transformation:** The `transformClientComponents` plugin now injects a virtual import for the `ssr`-processed version of the client module (e.g., `import * as SSRModule from "virtual:rwsdk:ssr:/path/to/component"`). This makes the module's *actual* implementation available to the `worker` runtime via the SSR Bridge.

2.  **Runtime Conditional Logic:** The `registerClientReference` function in the worker runtime has been updated. It now accepts the imported `SSRModule` and inspects each export.
    *   If an export is identified as a **React component** (using `react-is`), it returns a standard, serializable client reference placeholder, which is what the RSC renderer expects.
    *   If an export is a **non-component**, it returns the *actual export* from the `SSRModule` directly.

This allows any server-side code to import `MyUtil` from a client module and use it on the server, while still treating `<MyComponent>` from that same module as a client reference for the RSC phase.

The solution was validated with a new `import-from-use-client` playground that tests app-to-app, app-to-package, and package-to-package imports, and was also confirmed to resolve the integration issues with Chakra UI.

---

## Dev Server `optimizeDeps` Failure for Vendor Modules

### Problem

When using a component library (like Chakra UI) with numerous `"use client"` modules within `node_modules`, the Vite dev server fails during the `optimizeDeps` phase. The build errors indicate a failure to resolve the `virtual:rwsdk:ssr:...` imports for these vendor files.

This occurs because `transformClientComponents` unconditionally creates these virtual imports. While our `ssrBridgePlugin` can resolve them during a regular dev request, Vite's `optimizeDeps` process, which runs `esbuild` under the hood, lacks the necessary plugin context to do so.

### The Solution: Context-Aware Transformation

The correct approach is to transform vendor modules differently depending on whether the transformation is for the initial `optimizeDeps` scan or for a subsequent dev server request.

The `transformClientComponents` function receives a context object that includes an `isEsbuild` flag. This flag is true only when the transform is being run as part of our initial dependency scan for `optimizeDeps`. This allows for a more nuanced transformation.

1.  **Detect the `optimizeDeps` Context:** The transform will check for the specific context: `isDev && isNodeModule && ctx.isEsbuild`.

2.  **Conditional Import Logic:**
    -   If the context matches (i.e., a vendor module being processed for `optimizeDeps`), the transform will generate an import from the **vendor barrel file**. This provides `esbuild` with a single, resolvable entry point.
    -   In all other cases (app code, or vendor modules being processed by a regular dev server request), the transform will generate the standard `virtual:rwsdk:ssr:` import. The Vite dev server can resolve this correctly and more efficiently via the `ssrBridgePlugin`.

This change aligns the client component transformation with the dev server's dependency optimization strategy, ensuring that SSR versions of vendor modules are resolved correctly via the pre-built barrel file.

---

### Course Correction: Simplifying the Dev Server Logic

**Thought Process:**
After further consideration, the previous approach of differentiating between the `esbuild` (`optimizeDeps`) context and the regular Vite dev server context was an over-complication. The core issue is simpler: `node_modules` dependencies in a development environment have a specific set of requirements for pre-bundling that application code does not.

The refined, simpler logic should be:
-   **Production:** All `"use client"` modules, regardless of location, are transformed to use the `virtual:rwsdk:ssr:` import. This is consistent and works with the production build process.
-   **Development:**
    -   App Code: `"use client"` modules within the application's source are transformed to use the `virtual:rwsdk:ssr:` import. The Vite dev server can handle this efficiently on the fly.
    -   Vendor Code: `"use client"` modules within `node_modules` are transformed to import their SSR counterpart from the pre-built **vendor barrel file**. This is the most robust way to ensure they are correctly handled by Vite's `optimizeDeps` process at startup.

This removes the need to check for the `isEsbuild` context and results in a more stable rule set.

**New Plan:**
1.  Revert the logic in `transformClientComponents.mts` to only depend on `isDev` and `isNodeModule`.
2.  Update the tests in `transformClientComponents.test.mts` to match this reverted, simpler logic.

---

## Pivot: End-to-End Validation with a Local Package

**Rationale:**
Unit tests for the transform function are passing, but the ultimate goal is to support complex, real-world scenarios, particularly those involving component libraries like Chakra UI. The most effective way to validate this is to pivot back to end-to-end testing using a local package that simulates a `node_modules` dependency.

**The Three Core Scenarios:**
The e2e test must validate three distinct import patterns between server and client modules:
1.  **App -> App:** A server module in the application source (`src/app/...`) imports a non-component export from a client module also in the application source.
2.  **App -> Package:** A server module in the application source imports a non-component export from a client module within a package (`packages/ui-lib`).
3.  **Package -> Package:** A server module within a package imports a non-component export from a client module within that same package.

**Plan:**
1.  **Create a New Playground:** Set up a new `playground/ssr-inter-module-imports` directory.
2.  **Create a Local `ui-lib` Package:**
    -   Inside the playground, create `packages/ui-lib`.
    -   It will contain a `client.tsx` module (`"use client"`) that exports a client component and a utility function.
    -   It will also contain a `server.tsx` module (a server component) that consumes the utility function from its own package's client module (testing Scenario 3).
3.  **Set up the Playground App:**
    -   Create a local client utility module in `src/app/lib` (for Scenario 1).
    -   Update the `Home.tsx` page to import and use utilities from the local client module (Scenario 1) and the `ui-lib` client module (Scenario 2). It will also render the server component from `ui-lib` (which validates Scenario 3).
4.  **Update E2E Test:**
    -   Write assertions to confirm that the server-rendered HTML contains the correct output from all three utility functions.
    -   Add assertions to ensure all client components are interactive.

---

## Add Conditional Exports to `ui-lib`

**Rationale:**
To make the e2e test for our local `ui-lib` package more robust and realistic, it should behave like a production-ready component library. This means it must correctly use `package.json` conditional exports to prevent its modules from being used in the wrong environment.

-   **Client modules** (like `ui-lib/client`) should throw an error if an attempt is made to import them in a `react-server` context.
-   **Server modules** (like `ui-lib/server`) should throw an error if an attempt is made to import them in a context *without* the `react-server` condition.

**Plan:**

1.  **Create Error-Throwing Modules:**
    -   Create `packages/ui-lib/react-server-only.ts` which will contain code that immediately throws an error, indicating it should only be used in a `react-server` environment.
    -   Create `packages/ui-lib/no-react-server.ts` which will throw an error indicating it cannot be used in a `react-server` environment.

2.  **Update `ui-lib`'s `package.json`:**
    -   Modify the `exports` map to include `react-server` and `default` conditions.
    -   For the `./client` export, the `react-server` condition will point to `no-react-server.ts`, and the `default` condition will point to the actual `client.tsx` module.
    -   For the `./server` export, the `react-server` condition will point to the actual `server.tsx` module, and the `default` condition will point to `react-server-only.ts`.

This will ensure that any incorrect bundling or module resolution in our build system will cause an immediate and clear failure during the e2e test, making the test a much stronger validation of our system's correctness.

---

### Convert `ui-lib` to a Proper ESM Package

**Problem:**
The local `ui-lib` package was created with `.ts` and `.tsx` files, but it lacks a `"type": "module"` entry in its `package.json` and uses incorrect file extensions in its `exports` map. This will cause resolution failures in a native ESM environment. It also lacks type definition files, which is not realistic for a library.

**Plan:**
1.  **Rename Source Files:**
    -   Rename `client.tsx` to `client.mtsx`.
    -   Rename `server.tsx` to `server.mtsx`.
    -   Rename `no-react-server.ts` to `no-react-server.mts`.
    -   Rename `react-server-only.ts` to `react-server-only.mts`.
2.  **Update `package.json`:**
    -   Add `"type": "module"` to the root of the JSON object.
    -   Update the paths in the `exports` map to reflect the new `.mtsx`/`.mts` extensions.
3.  **Create Type Definitions:**
    -   Create `client.d.ts` to provide types for the exports of `client.mtsx`.
    -   Create `server.d.ts` to provide types for the exports of `server.mtsx`.

---

### Course Correction: Simplify `ui-lib` to Plain JS, Remove Conditionals

**Rationale:**
The goal of this e2e test is to validate the core SSR Bridge mechanism for importing from client modules in various scenarios. Adding `react-server` conditional exports to the local `ui-lib` package, while realistic for a production library, is an unnecessary complication for this specific test and was interfering with the experiment.

The package should be a simple, pre-compiled ESM module using plain JavaScript.

**Revised Plan:**
1.  **Remove Conditional Exports:** The `exports` map in `packages/ui-lib/package.json` will be reverted to a simple mapping without `react-server` conditions.
2.  **Delete Unused Files:** The `no-react-server.mts` and `react-server-only.mts` files are no longer needed and will be deleted.
3.  **Convert to Plain JavaScript:**
    -   Rename all `.mtsx` and `.mts` files in `ui-lib` to `.mjs`.
    -   Manually transpile the JSX content in the component files to standard `React.createElement` calls.
    -   Correct the application's client utility file (`src/app/lib/client-utils.ts`) to be a `.mjs` file with transpiled content as well, to ensure consistency.

---

### `esbuild` Resolution Error for Virtual SSR Modules

**Problem:**
After implementing the barrel file import for `node_modules` in the dev server, the `e2e` tests fail during Vite's dependency optimization (`optimizeDeps`). The `esbuild` process within the `worker` environment cannot resolve the virtual import:

```
[ERROR] Could not resolve "virtual:rwsdk:ssr:rwsdk/__vendor_client_barrel"
```

This happens because the `worker`'s optimizer has no knowledge of the `virtual:rwsdk:ssr:` prefix, which is handled by the `ssrBridgePlugin`. The `optimizeDeps` scan runs before the `ssrBridgePlugin`'s `load` and `resolveId` hooks are fully engaged for these paths.

**Plan:**
The solution is to instruct the `worker` environment's `optimizeDeps` process to treat these virtual modules as external. This will prevent `esbuild` from trying to resolve them directly. The resolution will be deferred to runtime, where the `ssrBridgePlugin` can correctly intercept the virtual IDs, bridge them to the `ssr` environment, and load the processed modules.

This will be implemented by modifying the `rwsdk-ssr-external` esbuild plugin within `ssrBridgePlugin.mts` to mark any import path starting with `virtual:rwsdk:ssr:` as `external: true`.

---

### React Render Error: Prod/Dev Mismatch

**Finding:**
With the `esbuild` resolution error fixed, the tests now fail with a new error originating from within React's server rendering logic:

```
TypeError: Cannot read properties of undefined (reading 'stack')
```

And a related warning:

```
Attempted to render <async (requestInfo2) => ...> without development properties. This is not supported. It can happen if:
- The element is created with a production version of React but rendered in development.
```

The component being rendered appears to be related to middleware. This suggests that the SSR Bridge is now functioning, but it may be causing a mismatch in how React's development and production builds are being resolved or bundled between the `worker` and `ssr` environments.

---

### TypeError: `format` is not a function

**Resolution of Previous Error:**
The React prod/dev mismatch was caused by dependency issues in the `import-from-use-client` playground. The `react-server-dom-webpack` package was missing, and other React-related dependencies were not aligned with the versions used across the monorepo. Adding the missing dependency and synchronizing all `react` and `@types/react` versions in `dependencies` and `devDependencies` resolved the issue.

**New Finding:**
After fixing the dependencies, a new, more specific error has appeared:

```
TypeError: __vite_ssr_import_2__.packageClientUtil.format is not a function
```

This error occurs when the `PackageServerComponent` attempts to call `packageClientUtil.format`. It indicates that while the `ui-lib/client.mjs` module is being imported across the SSR Bridge, its exports are not being correctly resolved. The `packageClientUtil` object is either not being found on the imported module (`__vite_ssr_import_2__`) or the module itself is not what's expected, pointing to a potential issue in how the `ssr` environment processes and returns the module's contents to the `worker`.

---

### Uneven Transformation of Client Modules

**Finding:**
Through detailed logging, a key discrepancy was discovered:

1.  **Application Client Module (`/src/app/lib/client-utils.mjs`):** The `transformClientComponents` plugin runs as expected. It injects calls to `registerClientReference`, and the runtime logs confirm that `registerClientReference` is executed for each export. The `isValidElementType` check correctly separates the component (`AppButton`) from the non-component (`appClientUtil`), and the utility object is returned correctly.

2.  **Package Client Module (`ui-lib/client.mjs`):** The `transformClientComponents` plugin does **not** seem to run on this module. There are no logs from `registerClientReference` for its exports (`PackageButton`, `packageClientUtil`).

Despite this, the `packageClientUtil` object is still being transformed into a client reference, but by a different, older mechanism. This is evident because the logged object has a `__rwsdk_clientReferenceId` property, which is a remnant of a previous implementation.

**Conclusion:**
There are two separate transformation pipelines for client components: one for application source files and another for `node_modules` dependencies. The pipeline for dependencies is outdated and does not include the new SSR Bridge logic. The next step is to locate and update this second pipeline.

---

### Resolution: Stale SDK Dependencies

**Investigation and Resolution:**
The root cause of the uneven transformation was a stale dependency issue within `pnpm`'s content-addressable store. Despite rebuilding the SDK locally, the symlinks in the playground's `node_modules` were still pointing to an old, cached version of the `rwsdk` package. This caused the old transformation logic to run for the `ui-lib` package, while the application code correctly used the latest logic from the new build.

The fix involved manually purging the stale SDK from the monorepo's `.pnpm` store and forcing a clean install:
1.  All `rwsdk` directories were deleted from the `.pnpm` directory to remove any cached versions.
2.  A fresh tarball of the SDK was created using `npm pack` inside the `sdk/` directory.
3.  This tarball was then installed directly into the `import-from-use-client` playground using `pnpm add <path-to-tarball>`.

This process ensured that the playground's `node_modules` contained a fresh, non-symlinked copy of the latest SDK build.

**Outcome:**
With the stale dependency issue resolved, the end-to-end tests now pass. All three import scenarios are working correctly. Both the application button and the package button are interactive, and messages from both client utility objects are rendered on the server as expected. This validates that the SSR Bridge and the updated `registerClientReference` function correctly handle non-component exports from `"use client"` modules, both in application code and in package dependencies.

---

### Validation with Chakra UI

**Resolution of TDZ and Other Errors:**
The set of errors encountered while testing with the Chakra UI playground, including the Temporal Dead Zone (TDZ) issue with the vendor barrel file, were ultimately traced back to the same root cause as the previous playground: stale SDK dependencies.

The `pnpm` symlinking mechanism was causing the Chakra playground to use a cached, outdated version of the `rwsdk`, which did not include the latest fixes. The complex build errors were red herrings stemming from this environmental issue.

**Solution:**
The solution was identical to the one used for the `import-from-use-client` playground. Creating a fresh tarball of the SDK (`npm pack`) and installing it directly into the Chakra UI playground's `node_modules` resolved all remaining issues.

**Conclusion:**
With a clean SDK installation, the Chakra UI playground now works correctly. This confirms that the new SSR bridging mechanism is robust and correctly handles complex, real-world component libraries. The feature is now considered validated for the dev server environment.
