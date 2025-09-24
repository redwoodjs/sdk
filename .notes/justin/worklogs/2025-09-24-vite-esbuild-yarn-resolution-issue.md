## Problem

ESBuild, running as part of Vite's dependency optimization step, is unable to resolve framework-internal modules like `rwsdk/worker`. This occurs when third-party dependencies in `node_modules` (e.g., Radix UI) are transformed to include imports from the framework. The issue appears to be specific to projects using Yarn Berry, even with the `node-modules` linker.

The framework's own `esbuild`-based scanner resolves these modules correctly, likely because it uses `enhanced-resolve`. However, Vite's optimizer does not seem to respect the aliases configured by the framework's Vite plugin, leading to resolution failures.

## Investigation and Findings

The initial plan to add a manual alias in the user's `vite.config.mts` was incorrect. It was a workaround, not a framework-level solution, and it interfered with the framework's own internal module scanner.

The core issue was identified as an **inverted resolution path**, which is common in monorepos using Yarn Berry's hoisting strategy.

1.  **Importer Location:** A dependency like `@radix-ui/react-dialog` is hoisted to the monorepo root's `node_modules` directory.
2.  **Importee Location:** The framework package, `rwsdk`, is installed in the workspace's `node_modules` directory (`apps/dashboard/node_modules`).
3.  **Resolution Failure:** Vite's `optimizeDeps` scanner runs `esbuild` starting from the Radix file at the monorepo root. A standard Node.js resolver walks *up* the directory tree from the file's location. It never looks *down* into the workspace's `node_modules` directory and therefore cannot find `rwsdk`.

This was confirmed by an experiment: when the Radix dependency was moved from the root into the workspace's `package.json` (preventing it from being hoisted), the resolution worked correctly. This confirms the problem is not a flaw in our framework's build logic itself, but a complex resolution context that the framework must handle.

## Proposed Solutions

Two primary strategies were identified to create a robust, framework-level fix without requiring user configuration.

### Approach A: Absolute Path Injection at Transform Time

This approach involves modifying the code transformation logic itself.

-   **How it works:** In every place where we inject an import to a framework module (e.g., in `transformClientComponents.mts`), instead of writing a bare specifier like `"rwsdk/worker"`, we would first resolve it to its absolute on-disk path from the perspective of the user's project. The transformed code would then contain the full, resolved path.
-   **Pros:** Direct and conceptually simple. The fix is applied exactly where the problematic import is created.
-   **Cons:** The resolution logic would be duplicated across multiple transform-related files. It could introduce potential brittleness if bundlers or caches have issues with absolute paths in source code.

### Approach B: Centralized `esbuild` Resolver Plugin

This approach involves teaching Vite's optimizer how to resolve the framework's modules correctly.

-   **How it works:** We would create a small, dedicated `esbuild` plugin. This plugin's sole purpose is to intercept imports beginning with `rwsdk/`. When it finds one, it uses Node's `require.resolve` API to find the module, but critically, it initiates the resolution from the user's project root directory. This plugin would then be injected into Vite's `optimizeDeps.esbuildOptions` from our main framework plugin.
-   **Pros:** Centralizes all optimizer-related resolution logic into a single, clean module. It is a more robust and scalable solution that keeps the generated code clean with standard import specifiers.
-   **Cons:** Slightly more abstract, as it involves hooking into a specific, internal part of Vite's build process.

## Test Plan: Simulating the Monorepo Environment

To validate the chosen solution (Approach B), a new playground example, `monorepo-yarn-hoist`, will be created to reliably reproduce the resolution error in an isolated environment.

1.  **Simulate Monorepo Structure:** The playground will contain a nested directory structure that mimics a monorepo:
    -   `packages/project/`: A copy of the `hello-world` application.
    -   `vendor/ui-lib/`: A local, fake UI library that acts as the "hoisted" dependency.
    -   A root `package.json` and `pnpm-workspace.yaml` will define this structure as a pnpm workspace.

2.  **Recreate Hoisting Scenario:**
    -   The root `package.json` will depend on `ui-lib` via the `file:` protocol, causing pnpm to link it to the root `node_modules`.
    -   The `packages/project/package.json` will depend on `rwsdk` (via `workspace:*`) and `ui-lib`. `rwsdk` will be installed in the project's local `node_modules`, while `ui-lib` will be resolved from the root.

3.  **Trigger the Resolution Failure:**
    -   The `ui-lib` will contain a simple component with a `"use client"` directive.
    -   The `Home.tsx` page in the `project` will import and use this component.
    -   This setup forces Vite's optimizer to scan a file (`ui-lib`) from a root context that then requires a module (`rwsdk`) located in a nested context, triggering the resolution failure.

4.  **Validation:** An end-to-end test will be created to run the dev server for the playground. This test will initially fail, confirming the bug reproduction. It will then be used to verify that the implemented fix (the esbuild resolver plugin) solves the issue.
