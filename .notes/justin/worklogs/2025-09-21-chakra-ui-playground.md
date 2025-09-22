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
