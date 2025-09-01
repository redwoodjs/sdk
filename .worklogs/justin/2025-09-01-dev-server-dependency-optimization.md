# Work Log: 2025-09-01 - Optimizing Dev Server Dependencies

## 1. Problem Definition & Goal

The primary goal is to improve the developer experience by optimizing how dependencies are handled in the dev server. The core problem has two symptoms:

*   **Slow Initial Startup:** The server takes a long time to become ready.
*   **In-Browser Request Waterfalls:** When using a component from a large library (like Mantine), the browser makes many sequential requests for individual module files, leading to noticeable lag and layout shifts during development.

This is happening because our framework's method of discovering `"use client"` modules forces Vite's `optimizeDeps` feature into an inefficient mode where it creates many small, fragmented chunks for library components instead of a single, unified one.

## 2. Investigation: Discarded Ideas & Why

We explored several potential solutions, each with a critical flaw:

*   **Use esbuild's `metafile`:** This was technically infeasible as Vite does not expose the `metafile` option for `optimizeDeps`.
*   **Run a preliminary esbuild pass:** A standalone esbuild pass would be unaware of the project's Vite configuration (e.g., `resolve.alias`), making it too fragile.
*   **Scan `node_modules`:** This would be unacceptably slow and defeat the purpose of the optimization.
*   **Use `optimizeDeps.include`:** This made a dangerous assumption that any `"use client"` file within a package would be reachable from that package's main entry point, which is not guaranteed for internal, un-exported components.

## 3. The Solution: The Virtual Dependency Barrel

We've landed on a robust solution that does not rely on package exports at all. The strategy is to create a **virtual module** in memory that acts as a "barrel" file, explicitly re-exporting every `"use client"` module found in `node_modules`.

1.  **Identify Client Modules:** During startup, our plugin will scan the project and its dependencies to populate the `clientFiles` set with the absolute paths of all modules containing the `"use client"` directive.
2.  **Generate a Virtual Barrel Module:** For the `client` and `ssr` environments, our plugin will create a virtual module (e.g., `virtual:rwsdk:client-module-barrel`). The content of this module will be a list of `export * from '...'` statements, one for each file in `clientFiles` that is located in `node_modules`.
3.  **Configure `optimizeDeps`:** We will add the name of this single virtual module to the `optimizeDeps.entries` array. A similar process will be followed for server modules.

### Rationale: Forcing a Single Dependency Graph

This approach is superior because:

-   **It's Explicit:** By feeding Vite a single entry point that directly imports every required module, we force its optimizer to see all library-based client components as part of one large, interconnected dependency graph.
-   **No Unsafe Assumptions:** It completely avoids the problem of internal/un-exported components because we are pointing directly to the specific files, not relying on the library's public API.
-   **Solves the Waterfall:** The result of the optimization will be a single, large chunk containing all the necessary library client code, which can be loaded in one request, definitively solving the in-browser request waterfall.

This plan is contingent on one assumption we'll validate during implementation: that the `client` and `ssr` environment plugins are configured *after* the `worker` environment has completed its initial scan and populated the `clientFiles` set.

## 4. Implementation & Refinements

As we moved from the plan to implementation, several key refinements were made to improve the modularity and robustness of the solution.

### 4.1. Plugin Refactoring for Clarity

The initial concept was monolithic, but the logic was broken down into two distinct and more aptly named plugins for better separation of concerns:

1.  **`directiveModulesDevPlugin.mts`**: This plugin's sole responsibility is to handle the dev-server optimization. It creates the virtual "barrel" modules for both client and server dependencies found in `node_modules`.
2.  **`directiveModulesBuildPlugin.mts`**: This plugin handles build-time optimizations. It tree-shakes (filters) any unused client or server modules that were discovered during the initial scan, ensuring they don't end up in the final production build.

This separation makes the purpose of each plugin clearer and the overall architecture easier to maintain.

### 4.2. Namespaced Barrel for Collision-Free Exports

The original plan was to have the barrel module re-export everything (`export * from '...'`). This approach had a potential flaw: two different modules could export a binding with the same name, leading to a collision.

To solve this, the implementation was changed to create a **namespaced barrel**. The virtual module now generates a default export that is an object where each key is the absolute file path of a module, and the value is the imported module itself (e.g., `import * as M0 from '...'`).

```javascript
// Example of the namespaced barrel module's content
import * as M0 from '/path/to/node_modules/library/a.js';
import * as M1 from '/path/to/node_modules/library/b.js';

export default {
  '/path/to/node_modules/library/a.js': M0,
  '/path/to/node_modules/library/b.js': M1,
};
```

### 4.3. Conditional Imports at the Lookup Level

The most significant refinement was *how* the barrel file is used. Instead of changing the runtime import logic, we modified the `createDirectiveLookupPlugin`. This plugin generates the `virtual:use-client-lookup` and `virtual:use-server-lookup` modules.

The generated code within these lookup modules is now "smarter." In development, it contains conditional logic:

-   If a module's path is in `node_modules`, it generates a dynamic import that loads our namespaced barrel and then looks up the correct module by its file path key.
-   If the module is a local project file, it generates a standard direct dynamic import (`import('/path/to/local/file.ts')`).

This final architecture is more sophisticated and robust than the original plan, achieving the goal of eliminating the request waterfall without requiring any changes to the runtime `import` logic and correctly handling all edge cases.

## 5. Lingering Problem: Fine-Grained Dependency Chunking

While the virtual barrel is being correctly identified as the entry point for `node_modules` dependencies, it has not fully solved the request waterfall problem.

The current observation is that the browser first loads the virtual barrel module. This module then initiates hundreds of subsequent requests for every individual dependency it imports. The initiator for this new waterfall is the barrel file itself.

This indicates that Vite's `optimizeDeps` is not bundling the contents of the barrel into a single chunk as intended. The likely cause is that the barrel contains standard ESM `import` statements with absolute paths, and Vite is resolving them one-by-one instead of treating the entire collection as a single dependency to be pre-bundled.

The next step is to investigate how to configure Vite to treat the entire dependency graph originating from our virtual barrel as a single entity to be flattened into one optimized file. This may require a different approach to how we use `optimizeDeps.entries` or `optimizeDeps.include`, or a change to how the imports within the barrel are structured.

