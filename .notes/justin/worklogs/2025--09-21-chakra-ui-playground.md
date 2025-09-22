The next step is to investigate Vite's dependency optimization process to understand why `@emotion/react` is being bundled incorrectly and find a way to direct it to the correct (SSR) bundle.

### Analysis of Chakra UI Source Code

An investigation into the Chakra UI monorepo revealed how the library is structured and where the client-side dependencies originate.

1.  **Dependency Analysis:** The `@chakra-ui/react` package is the one that directly depends on `@emotion/react`. All styled components within the library are built on top of this foundation.

2.  **Core Styling Factory:** The key file is `/packages/react/src/styled-system/factory.tsx`. This file acts as a "styling factory" for almost all Chakra UI components. It imports directly from `@emotion/react` to handle CSS-in-JS transformations.

3.  **Critical Finding:** The `factory.tsx` file has the `"use client"` directive at the very top.

4.  **Component Creation:** Components like `<Box>` are created by calling a `chakra()` function which is an export from this same `factory.tsx` file. For example, `export const Box = chakra("div")`.

### Conclusion

The investigation confirms that this is an issue with our framework's build process, not with Chakra UI's implementation.

-   Chakra UI has correctly marked its core styling engine—the foundation for all of its components—as a client-side module with `"use client"`.
-   Because every Chakra UI component is created using this factory, the entire `@chakra-ui/react` library should be treated as a client-side dependency by our bundler.
-   The `React2.createContext is not a function` error indicates that our build system is failing to respect the `"use client"` directive within a third-party dependency (`@chakra-ui/react`). It is incorrectly pulling client-only code (specifically, `@emotion/react`) into the RSC server environment.

The immediate next step is to debug our framework's Vite plugin and dependency scanning logic to understand why it's not correctly identifying and isolating these client components from `node_modules`.

### Investigation: The `"use strict"` Directive

A detailed analysis of the bundled Chakra UI files in `node_modules` revealed the root cause of the `createContext` issue.

-   **File Examined:** `node_modules/.pnpm/@chakra-ui+react@3.27.0_...@emotion+react@11.14.0/node_modules/@chakra-ui/react/dist/esm/styled-system/factory.js`
-   **Finding:** In the distributed ESM build of Chakra UI, the `"use client"` directive is preceded by a `"use strict";` directive.

-   **Hypothesis:** The `hasDirective` utility function, which scans files for `"use client"`, is too simplistic. It likely only checks the very first line of a file, failing to detect the directive if it's preceded by anything else.

### Fixing `hasDirective`

The initial attempt to fix `hasDirective` was incorrect, as it changed the function's public signature, which was not the intention. After reverting, a more surgical approach was taken:

1.  **Test Correction:** The test suite for `hasDirective` was updated to reflect its intended behavior and include a failing case for directives preceded by other string literals (like `"use strict"` or `"use something else"`).
2.  **Generalized Implementation:** The `hasDirective` function was modified to correctly handle the ECMAScript "directive prologue." It now iterates past any initial string literal expressions, comments, or whitespace to find the target directive. This makes it robust and spec-compliant.
3.  **Validation:** The corrected function passed all 16 tests.

This change successfully resolved the `React2.createContext is not a function` error.

### New Issue: `fieldAnatomy.extendWith is not a function`

With the directive scanning fixed, a new error surfaced during server-side rendering in the worker environment:

```
[vite] Internal server error: __vite_ssr_import_0__.fieldAnatomy.extendWith is not a function....
```

After resolving the directive scanning issue, a new error emerged: `TypeError: __vite_ssr_import_0__.fieldAnatomy.extendWith is not a function`.

### Deeper Analysis

The root cause of this issue stems from how RedwoodSDK handles modules marked with `"use client"`. The current implementation transforms the entire module into a set of client reference proxies. This is problematic for libraries like Chakra UI, which export not just components, but also other objects (like the `fieldAnatomy` object from `@ark-ui/react`) from these client modules.

Other server-side code in the library then imports and attempts to use these non-component exports. Because the entire module has been replaced with proxies, these objects are no longer available on the server, leading to the error.

Attempting to selectively transform only the component exports while preserving the non-component exports is not a viable solution. It would be complex and fragile, as those non-component objects might contain references to the components, creating a tangled dependency graph that's difficult to manage correctly.

### A Path Forward: Bridging Client Components for SSR

The problem is that when a `"use client"` module is encountered in the `worker` environment, its contents are completely replaced with a client reference proxy. This is correct for the RSC rendering pass, but it leaves the subsequent SSR pass without the actual component code needed to generate the initial HTML.

The proposed solution is to modify the client component transformation step:

1.  When transforming a client component for the `worker` environment, not only generate the client reference proxy, but also inject an import to an SSR-processed version of that same component. This import will use the SSR Bridge virtual module prefix (e.g., `import SSRComponent from 'virtual:rwsdk:ssr:/path/to/component'`).
2.  The `registerClientReference` function will be updated to accept this imported SSR component as a new first argument.
3.  The runtime can then store this SSR component alongside the client reference. When the SSR pass occurs, it can retrieve and render the actual component implementation instead of the proxy.

This approach elegantly bridges the gap between the two environments, ensuring the SSR renderer has access to the necessary code while keeping the RSC module graph clean.

### Transformation Example

Here is an example of how the transformation would be applied.

**Before Transformation (`/path/to/component.tsx`):**
```typescript
"use client";

export function MyComponent() {
  // component implementation
}

export const AnotherComponent = () => {
  // another component implementation
};

export { AnotherComponent as RenamedComponent };

export default function DefaultComponent() {
  // default export implementation
}
```

**After Transformation (in the `worker` RSC environment):**
```typescript
// 1. Import the SSR version of the component module via the bridge
import SSRModule from 'virtual:rwsdk:ssr:/path/to/component.tsx';

// 2. Import the client reference factory
import { registerClientReference } from "rwsdk/worker";

// 3. Create client reference proxies for each export, passing in the SSR module
const MyComponent = registerClientReference(SSRModule, "/path/to/component.tsx", "MyComponent");
const AnotherComponent = registerClientReference(SSRModule, "/path/to/component.tsx", "AnotherComponent");
const RenamedComponent = registerClientReference(SSRModule, "/path/to/component.tsx", "RenamedComponent");
const DefaultComponent = registerClientReference(SSRModule, "/path/to/component.tsx", "default");

// 4. Re-export the proxies with the same names
export { MyComponent, AnotherComponent, RenamedComponent };
export default DefaultComponent;
```
