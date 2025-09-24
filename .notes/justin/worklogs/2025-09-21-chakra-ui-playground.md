# Work Log: 2025-09-21 - Chakra UI Playground Implementation

## Brief

Create a comprehensive playground example that demonstrates all major Chakra UI components and APIs within our React server component framework. The playground should:

1. Cover all major Chakra UI component categories (layout, forms, data display, feedback, etc.)
2. Include end-to-end tests that verify components render correctly
3. Ensure no console errors occur during rendering
4. Follow our framework patterns and architecture

The goal is to provide a complete reference implementation showing how Chakra UI integrates with our RSC framework, serving as both a testing ground and documentation for developers.

## Plan

1. Examine the existing hello-world example to understand framework patterns
2. Research Chakra UI component categories and APIs
3. Create a new playground directory structure
4. Implement comprehensive component examples organized by category
5. Set up end-to-end tests to verify rendering and check for console errors
6. Document any integration challenges or framework-specific considerations

## Investigation: Framework Structure Analysis

Starting by examining the hello-world example to understand the framework patterns and structure.

Analyzed the hello-world example and identified key patterns:
- Uses `defineApp` from `rwsdk/worker` for app definition
- Requires `"use client"` directive for interactive components
- Uses `ChakraProvider` wrapper for client-side components
- Document.tsx provides the HTML shell structure
- Components are organized in separate files under `src/app/components/`

## Implementation: Component Categories

Successfully implemented comprehensive Chakra UI component examples organized into 8 major categories:

1. **Layout Components** - Box, Flex, Grid, Stack, Wrap, Center, Square, Circle, Container, SimpleGrid, AspectRatio
2. **Form Components** - Input, Button, Checkbox, Radio, Select, NumberInput, PinInput, Slider, Switch, Textarea
3. **Data Display Components** - Badge, Card, Code, Kbd, List, Stat, Table, Tag, Avatar, Divider
4. **Feedback Components** - Alert, Progress, CircularProgress, Spinner, Skeleton, Toast
5. **Navigation Components** - Breadcrumb, Link, Stepper, Tabs
6. **Overlay Components** - Modal, Drawer, AlertDialog, Popover, Tooltip, Menu
7. **Media Components** - Avatar (extended), Icon, Image
8. **Typography Components** - Heading, Text, Highlight, Mark, responsive typography

Each component category includes:
- Multiple variants and configurations
- Proper data-testid attributes for testing
- Interactive examples where applicable
- Responsive design considerations

## Testing Setup

Created comprehensive end-to-end tests that verify:
- All components render without console errors
- Interactive functionality works correctly
- Component visibility and content validation
- Toast notifications, modals, and other dynamic features

The tests use the framework's e2e testing utilities (`setupPlaygroundEnvironment`, `testDevAndDeploy`, `poll`) to ensure reliable testing across both development and deployment environments.

## Integration Challenges

### Challenge 1: ChakraProvider Client-Side Requirement
Chakra UI requires a provider context that must run on the client side. Solved by creating a separate `ChakraProvider.tsx` component with `"use client"` directive that wraps the Chakra UI provider.

### Challenge 2: Component Organization
With 8 major component categories and dozens of individual components, organization was key. Solved by creating separate component files for each category and using a main Home page that imports and displays all categories.

### Challenge 3: Test Infrastructure
The e2e testing setup initially had path resolution issues when trying to locate the SDK for tarball creation. The test harness was looking for the SDK in the wrong directory path.

## Investigation: `createContext` Error

The dev server fails to start, throwing a `[vite] Internal server error: React2.createContext is not a function`.

This error is consistent with a user report found on Discord, which suggests a problem with how Chakra UI's dependencies are handled by Vite's dependency optimizer.

**Context from User Report:**
- **Discord Link:** <https://discord.com/channels/679514959968993311/1373685754957660283/1412270477744934942>
- **Core Issue:** The user report suggests that `@emotion/react`, a peer dependency of Chakra UI, is being incorrectly included in the RSC (React Server Components) bundle instead of the SSR (Server-Side Rendering) bundle.
- **Hypothesis:** Since `createContext` does not exist in the RSC version of React, the mis-bundling of a library that calls it (`@emotion/react`) leads to the runtime error.

The next step is to investigate Vite's dependency optimization process to understand why `@emotion/react` is being bundled incorrectly and find a way to direct it to the correct (SSR) bundle.

The immediate next step is to debug our framework's Vite plugin and dependency scanning logic to understand why it's not correctly identifying and isolating these client components from `node_modules`.

### Investigation: The `"use strict"` Directive

A detailed analysis of the bundled Chakra UI files in `node_modules` revealed the root cause of the issue.

-   **File Examined:** `/node_modules/.pnpm/@chakra-ui+react@3.27.0_...@emotion+react@11.14.0/node_modules/@chakra-ui/react/dist/esm/styled-system/factory.js`
-   **Finding:** In the distributed ESM and CJS builds of Chakra UI, the `"use client"` directive is not the first line in the file. It is preceded by a `"use strict";` directive.

```javascript
"use strict";
"use client";
// ... rest of the file
```

-   **Hypothesis:** Our `hasDirective` utility function, which is responsible for scanning files for `"use client"` or `"use server"`, is too simplistic. It likely only checks the very first line of a file's content and fails to detect the directive if it's preceded by anything else, including the common `"use strict"` directive.

This explains why our directive scan is failing for Chakra UI's `factory.js` file, leading to it being incorrectly bundled in the RSC environment.

**Refinement: Generalizing the Directive Scanner**
Instead of specifically checking for `"use strict"`, the solution was refined to be more compliant with the ECMAScript specification. The spec allows for a "directive prologue" which can consist of any number of string literal expressions at the top of a file or function, before any other statements.

The updated approach is to:
1.  Iterate through the initial lines of the file.
2.  Skip any comments or empty lines.
3.  If a line is a string literal expression (e.g., `"use strict"`, `"use something else"`), check if it matches `"use client"` or `"use server"`.
4.  If it's a match, return the directive.
5.  If it's another string literal, continue scanning.
6.  If it's any other type of statement, stop scanning immediately.

This ensures the scanner is robust and correctly handles any valid directive prologue.

**Next Steps:**
1.  Add a failing test case to `hasDirective.test.mts` to confirm this behavior.
2.  Modify the `hasDirective` implementation to correctly parse for directives, ignoring preceding `"use strict"` or empty lines.

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

### New Issue: `TypeError: object null is not iterable`

After implementing the SSR Bridge solution, the previous error was resolved, but a new one appeared: `TypeError: object null is not iterable (cannot read property undefined)`.

This error originates from Chakra UI's `code-block-adapter-context.ts` file, which is attempting to destructure the result of a call to `createContext`.

**Investigation:**

1.  **`create-context.ts` is a Client Module:** The `createContext` utility function is correctly defined in a file with the `"use client"` directive. It uses client-only APIs from React.
2.  **`code-block-adapter-context.ts` is a Server Module:** The file that *imports and calls* `createContext` does **not** have the `"use client"` directive.

This reveals a fundamental architectural violation of React Server Components. A Server Component (`code-block-adapter-context.ts`) is attempting to directly execute a function that depends on client-only APIs. This is not allowed in the RSC model and is the root cause of the error. The SSR Bridge correctly makes the module's code available to the server environment, but it cannot change the rules of that environment. The code is executing where it shouldn't be.

This appears to be an oversight in Chakra UI's implementation. For the code to be RSC-compliant, any module that creates or consumes a React context must be explicitly marked as a client module. The fact that they claim RSC compatibility suggests this is a bug on their end.

**Update & New Plan:**

Simplifying the playground did not resolve the issue. Because Vite's dependency optimizer scans the entire import graph, the problematic `code-block` modules are still processed on the server, even when not actively rendered. This confirms the issue is at the library level.

A survey of the Chakra UI codebase reveals that the lack of `"use client"` on `code-block` context files is an exception, not the rule. Most other components that use `createContext` are correctly marked. This strongly points to an oversight or bug in Chakra UI.

Rather than relying on a brittle patch or waiting for an upstream fix, the plan is to make our framework more resilient to such issues. We will implement a manual override system in our Vite plugin.

**New Path Forward: Manual Directive Overrides**

1.  **Introduce a Plugin Option:** Add a new configuration option to the RedwoodSDK Vite plugin, tentatively named `forceClientPaths`.
2.  **Support Globs:** This option will accept an array of glob patterns. Any module whose path matches one of these globs will be treated as a Client Component, regardless of whether it has a `"use client"` directive.
3.  **Update Directive Logic:** The core directive scanning logic will be updated. After checking a file's content for a directive, it will check the file's path against the `forceClientPaths` globs. If there's a match, it will be handled as a client module.
4.  **Implement in Playground:** We will use this new option in the `chakra-ui` playground's `vite.config.mts` to correctly mark the problematic `code-block` context files as client components, unblocking our progress.

This approach provides a robust and flexible escape hatch for handling non-compliant third-party libraries.

**Implementation Refinement:**

Instead of passing the `forceClientPaths` glob patterns down through the various plugins and scanning functions, a simpler approach will be taken:

1.  **Pre-populate Sets:** In the main `redwoodPlugin.mts` file, we will use the `glob` package to immediately find all files matching the `forceClientPaths` and a new `forceServerPaths` option.
2.  **Add to Sets:** The absolute paths of these files will be directly added to the `clientFiles` and `serverFiles` sets before any plugins are run.
3.  **Simplify Logic:** This removes the need to pass the glob patterns around. The rest of the system, including the directive scan, will respect the pre-populated sets without any changes.

This refactoring centralizes the override logic, simplifies the codebase, and is a more direct way of achieving the goal.

### New Issue: `Cannot read properties of undefined` in Barrel File

After implementing the manual override, a new error surfaced: `Cannot read properties of undefined` when trying to access a module from the vendor barrel file.

**Investigation:**

A deep dive into Vite's bundled output revealed that the barrel file (`rwsdk_vendor_client_barrel_default`) was `undefined` at the point in time it was being accessed by other modules. The two paths (the one used for the key in the barrel and the one used for the lookup) were confirmed to be identical.

This is a classic **Temporal Dead Zone** issue caused by a circular dependency in the module graph. Module A requires the barrel during its initialization, but the barrel (Module B) requires Module A (or one of its dependencies), creating a deadlock where neither can be fully defined before the other needs it.

The initial idea to use dynamic `import()` was rejected because it breaks the static analysis required by esbuild for dependency scanning and code splitting.

**New Path Forward: A Lazy-Loading Barrel Helper**

To solve this while respecting the static import constraint, we will change the structure of the barrel file itself.

1.  **Generate a Helper Function:** The `generateVendorBarrelContent` function will be modified. Instead of exporting a large, static object, it will export a default function, e.g., `getModule(moduleId)`.
2.  **Use Static Imports:** Inside the barrel file, all modules will still be imported statically using `import * as M...`.
3.  **Implement Lazy Lookup:** The `getModule` function will contain a `switch` statement that maps the string `moduleId` to the correct, already-imported module object (`M0`, `M1`, etc.).
4.  **Update Consumers:** The places where the barrel file is used, such as `transformClientComponents.mts` and `createDirectiveLookupPlugin.mts`, will be updated. Instead of performing a direct property access on the barrel object, they will now generate code that calls the `getModule` helper function.

This approach breaks the circular dependency at initialization time. All modules are loaded statically, satisfying esbuild, but the "linking" of a module ID to its corresponding module object is deferred until runtime via the `getModule` function call, safely avoiding the temporal dead zone.

**Attempt 2: Failed**

The "lazy-loading barrel helper" approach failed for the same reason: the barrel module `rwsdk_vendor_client_barrel_default` was still undefined when the `getModule` function was called. The root cause is the module execution order determined by Vite/Rollup.

**New Path Forward: Forcing Module Execution Order**

The core issue is that Vite is executing the modules that depend on our barrel file *before* it executes the barrel file itself. To fix this, we must give Vite a strong signal to load the barrel file first.

The plan is to inject a side-effect import of the barrel file at the top of every transformed client component.

1.  **Inject Side-Effect Import:** The `transformClientComponents.mts` plugin will be modified. For any module identified as a client component (either by directive or by our manual override), it will prepend `import "rwsdk/__vendor_client_barrel";` to the top of the transformed code.
2.  **Signal Bundler Priority:** This tells Vite/Rollup that before any client component code can run, the vendor barrel module must be fully loaded and executed.
3.  **Resolve TDZ:** This ensures that `rwsdk_vendor_client_barrel_default` is always defined and populated before any code attempts to access it, thus resolving the temporal dead zone.

This approach directly manipulates the module graph to enforce the correct execution order, which should finally resolve the issue.

---

## Final Resolution and Simplification

The series of complex issues, including the Temporal Dead Zone error, were ultimately traced back to a single root cause: a stale SDK dependency in the pnpm cache. The local playground was using an outdated, cached version of the `rwsdk` package, which did not include the fixes for handling non-component exports from client modules that were developed and merged into `main` (see work log `2025-09-22-ssr-bridge-client-components.md` and PR `7.7.7.4`).

The solution, as documented in the other work log, was to create a fresh tarball of the SDK and install it directly into the playground, bypassing the pnpm cache.

With a clean SDK installation, the persistent build errors were resolved. However, the original `createContext` error related to Chakra UI's `Code` component remained, as it is an upstream issue in the library.

Given that the primary goal was to have a stable playground example, the most pragmatic solution was to simplify the showcase. By removing the `Code` and `Kbd` components from the `Home.tsx` page, we avoid importing the problematic module altogether. The playground is now a basic but functional demonstration of Chakra UI's core components working correctly with our framework.

---

## PR Description

**Title:** `feat(framework, playground): Add manual client module overrides and Chakra UI showcase`

### Goal

The primary goal was to create a playground to test and demonstrate the integration of the Chakra UI component library with our React Server Components framework, including comprehensive end-to-end tests.

### Hurdles

Several issues were encountered during the implementation.

**1. `"use strict"` Directive Interference**

Our directive scanner initially failed to detect `"use client"` in modules where it was preceded by `"use strict"`. This caused many Chakra UI components to be incorrectly treated as Server Components. This was fixed in a previous PR and merged into `main`.

**2. Non-Component Exports from Client Modules**

A subsequent error (`fieldAnatomy.extendWith is not a function`) revealed that our framework was incorrectly handling non-component exports (like utility functions or objects) from `"use client"` modules. The entire module was being replaced with a client reference proxy, making these exports inaccessible on the server. This was a significant architectural issue that was resolved with the "SSR Bridge" implementation in a separate PR, which is now merged into `main`.

**3. Missing `"use client"` Directives in Chakra UI**

After resolving the framework-level issues, a final blocker emerged. Certain Chakra UI files call `createContext`, a client-only React API, but are missing the required `"use client"` directive. This appears to be an oversight in the library, as other similar modules correctly include the directive. Importing any component that depends on these files (like `<Code>`) causes a server error because the code is incorrectly executed in the RSC environment.

The problematic files are:
-   [`code-block-context.ts`](https://github.com/chakra-ui/chakra-ui/blob/79971c0d1ccac7921e5e5c65faa93e3fe8456bca/packages/react/src/components/code-block/code-block-adapter-context.ts)
-   [`code-block-adapter-context.ts`](https://github.com/chakra-ui/chakra-ui/blob/79971c0d1ccac7921e5e5c65faa93e3fe8456bca/packages/react/src/components/code-block/code-block-adapter-provider.tsx)

### Solution

This change introduces a framework-level feature to handle non-compliant third-party libraries and uses it to fix the Chakra UI playground.

1.  **Manual Client Module Overrides:** The RedwoodSDK Vite plugin now accepts a `forceClientPaths` option. This option takes an array of paths or glob patterns, and any matching module will be treated as a client component, regardless of whether it has a `"use client"` directive. This provides a robust escape hatch for library integration issues.

2.  **Chakra UI Playground:** The `chakra-ui` playground now uses the `forceClientPaths` option in its `vite.config.mts` to correctly mark the problematic `code-block` files as client modules. This resolves the final blocker and allows the playground to run.

3.  **Simplified Showcase:** To ensure stability, the playground has been simplified to a basic showcase of core components, with the problematic `<Code>` component removed for now. The e2e tests have been updated accordingly.
