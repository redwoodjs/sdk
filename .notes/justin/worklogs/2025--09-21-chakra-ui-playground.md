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
