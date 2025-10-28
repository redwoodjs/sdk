# 2025-10-28: Fixing Content Collections Build-Time Generation

## Problem

I've run into a lifecycle issue with libraries that generate code during the build process, specifically `Content Collections`. This library uses Vite's `buildStart` hook to generate typed collections from content files (e.g., markdown).

My framework's build process relies on a directive scan (`"use client"`, `"use server"`) that runs *before* the main Vite build begins. This scan is necessary to configure Vite's internals correctly. The problem is that this scan happens *before* `Content Collections` has a chance to run its `buildStart` hook and generate its files. Consequently, if any of those generated files contain directives, my scan misses them, leading to build failures.

## Investigation and Solution

My initial thought was to find a way to trigger the code generation step before my scan. I considered a few options:

1.  **Manually Invoke Plugin Hooks**: I could try to find the `Content Collections` plugin in the Vite config and call its `buildStart` hook myself. I quickly dismissed this as being too fragile. It would require reverse-engineering the context Vite provides to hooks, which would be a maintenance nightmare and likely break with any Vite update.

2.  **A Full Pre-Build Pass**: Another idea was to run a full, separate Vite build before the main one, just to trigger the codegen. I was very hesitant about this. A full build is expensive, and more importantly, it felt like a high-risk change that could introduce instability or unexpected side effects for existing projects.

After discussing the problem, a much more surgical solution became clear. The key insight is that Vite's build process is graph-driven. Most hooks (`resolveId`, `load`, `transform`) are only triggered as Vite traverses the module graph, starting from the specified entry points. The `buildStart` hook, however, is a lifecycle hook that runs once at the beginning, before any graph traversal.

This led to the chosen solution:

**A Minimal "Plugin Setup" Build Pass**

Before the directive scan, a new, minimal build pass is introduced. This pass is configured to be as inert as possible:
*   **No Entry Points**: Its `rollupOptions.input` is an empty array (`[]`).
*   **No Output**: Its `build.write` option is set to `false`.

Because there are no entry points, Vite has no module graph to traverse. This effectively prevents it from running the `resolveId`, `load`, and `transform` hooks on any of the project's source files. However, it *does* initialize the build process, which is enough to trigger the `buildStart` hooks on all plugins.

This approach isolates the desired side effect (running `buildStart` for `Content Collections`) without the cost or risk of a full build. It uses Vite's own public APIs and lifecycle guarantees, making it a robust and low-impact solution.

**Update**: My initial attempt to use an empty array for the `input` option failed. It appears Rollup, under the hood, requires at least one valid entry point to initialize, even if no processing is to be done. The solution was refined to create a temporary, empty dummy file to use as the entry point for the setup pass. This file is created just before the pass and deleted immediately after, satisfying Rollup's requirement without changing the no-op nature of the build.

**Update 2**: A subsequent test run showed that simply providing a temporary entry file was not enough. The Cloudflare Vite plugin specifically asserts that an entry chunk named `index` must exist. The solution was further refined to name the output chunk for our temporary file `index` by passing an object to `rollupOptions.input` (e.g., `input: { index: tempEntryPath }`). This satisfies the Cloudflare plugin's expectation while keeping the pass inert.

## Plan

1.  **Implement the plugin setup pass**: Add the minimal build pass to `sdk/src/vite/buildApp.mts`, using a temporary dummy file as the entry point and naming the output chunk `index`.
2.  **Update Architecture Docs**: Revise `docs/architecture/directiveScanningAndResolution.md` to include this new pre-scan step and the rationale behind it.
3.  **Add E2E Test**: Create a new playground example that uses `Content Collections` and add a simple end-to-end test to verify that content generated at build-time is correctly rendered. This serves as a regression test for the fix.

---

## PR Info

**Title**: `fix(build): Introduce plugin setup pass for build-time code generation`

**Description**:

### Problem

Vite plugins that generate code at build time, such as `Content Collections`, typically use the `buildStart` hook to perform their work. The framework's directive scan, which is necessary to configure the main build, was running *before* this hook. This created a lifecycle mismatch: if any generated files contained `"use client"` or `"use server"` directives, the scan would miss them, leading to build failures.

### Solution

This change introduces a "plugin setup pass"—a minimal, no-op Vite build that runs before the directive scan.

This pass is configured to be inert: it uses a temporary, empty file as an entry point and is set not to write any output. Its sole purpose is to trigger the `buildStart` hook for all configured plugins, ensuring that any necessary code generation is complete before the directive scan begins.

To ensure compatibility, the temporary entry point is named `index`, satisfying an assertion in the Cloudflare Vite plugin. This approach uses Vite's public APIs to resolve the lifecycle issue in a surgical way, without the performance cost or potential side effects of a full pre-build.

### Changes

-   Adds a "plugin setup pass" to the `buildApp` function.
-   Creates a new `content-collections` playground example to serve as a regression test.
-   Updates the `directiveScanningAndResolution.md` architecture document to reflect the new build phase.
