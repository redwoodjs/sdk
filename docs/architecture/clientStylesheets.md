# Architecture: Supporting Client-Side Stylesheet Imports

**Goal:** Allow developers to `import './styles.css'` inside a "use client" component and have it "just work," without causing a Flash of Unstyled Content (FOUC) in production.

## The Core Problem: Discovering Dynamic Dependencies in a Streaming World

### Why Vite's Default Behavior Isn't Enough
In a standard Vite-based Single-Page Application (SPA), stylesheet handling is managed through a well-defined process.
- In **development**, Vite serves an `index.html` file. When the browser requests a JavaScript module that imports a CSS file, Vite intercepts the import, injects the styles via a `<style>` tag, and enables Hot Module Replacement (HMR).
- In **production**, Vite uses the `index.html` file as the entry point. During the build, it scans all the JavaScript modules linked from that HTML file, finds their CSS imports, bundles the CSS into files, and automatically injects the final `<link>` tags back into the `index.html`.

Our framework's architecture makes this standard approach impossible for two main reasons:
1.  **No `index.html`:** We use a dynamic, server-rendered `Document.tsx` component as the HTML shell. This gives developers full control, but it means Vite has no static entry point to analyze.
2.  **React Server Components (RSC):** The full list of components (and therefore their CSS dependencies) is not known upfront. It is discovered dynamically as the RSC stream is rendered on the server.

Because of these architectural choices, we cannot rely on Vite's built-in mechanisms for production builds. We must build a system that can discover all static and dynamic CSS dependencies during a server-side render and ensure the necessary `<link>` tags are injected into the final HTML `<head>`. This leads to a specific set of challenges.

### The Challenges
1.  **The HTML Stream Ordering Problem:** To avoid a Flash of Unstyled Content (FOUC), all `<link rel="stylesheet">` tags for a page must be in the `<head>`. However, the `<head>` is the very first part of the HTML document sent to the browser, long before we have processed the server components that would tell us which CSS to include.

2.  **The Dev Server Performance Problem:** In development, the Vite dev server does not know a client module's full dependency graph until that module is requested and evaluated. An initial approach to solve this involved forcing this evaluation on the server by using Vite's `transformRequest()` API for every potential client-side script. While this worked for simple applications, it introduced a significant performance bottleneck. As an application's dependency graph grew, the cost of these synchronous transforms became prohibitive, leading to unacceptably slow server response times.

3.  **The Render-Time Discovery Problem:** We don't know the full list of components for a page ahead of time. As the RSC stream is rendered on the server, it can dynamically decide to include "use client" components (islands). If `ComponentA` imports `./styles.css`, we only discover that this stylesheet is needed when `ComponentA` is actually rendered. Our build process transforms all "use client" modules into calls to a `registerClientReference` function at module-load time, which gives us a complete list of all *potential* client components that could be used. However, we have no way of knowing which ones are *actually* used in a specific request until render time.

4.  **The Entry Point Discovery Problem:** The framework has no built-in knowledge of the main client-side entry point (e.g., `<script src="/src/client.tsx">`). This script is referenced inside the developer's `Document.tsx` file, and we need a way to find it so we can also find *its* CSS dependencies.

We cannot simply pause rendering to find all these dependencies, as that would eliminate the benefits of streaming. We need a system that can discover all these scripts—both the static entry points and the dynamically loaded components—and then use that complete list to inject all the necessary `<link>` tags into the `<head>` just in time.

### The FOUC Trade-off in Development

The performance issues with on-the-fly style discovery in development forced a re-evaluation of our goals. The original goal was to prevent FOUC in *all* environments. However, the complexity and performance cost of achieving this in development proved to be too high.

We have made the decision to accept a Flash of Unstyled Content (FOUC) in the development environment. This is a deliberate trade-off: we sacrifice perfect styling on initial page load during development in exchange for a significantly faster and more stable developer experience. In production, FOUC is still prevented.

This decision simplifies the development process immensely. We no longer need to compute a manifest on the fly. Instead, we delegate style handling entirely to Vite's client-side runtime, which is highly optimized for HMR and fast updates.

## The Solution: A Unified Discovery and Environment-Aware Injection Process

Our solution is to create a single, unified set of all client-side scripts that will be loaded on the page. By collecting every script module ID first, we can then, in a single final step, look up all their combined CSS dependencies and inject them in an environment-aware manner.

This process is detailed in the [Unified Script Discovery](./unifiedScriptDiscovery.md) documentation. This process has two main phases: **Discovery** (populating the list of scripts) and **Injection** (finding and rendering their stylesheets).

### Phase 2 (Runtime): Unified Stylesheet Injection

This is the final, unified step. The component that wraps the RSC stream (`RscApp` in our conceptual example) waits for the entire stream to be processed using React Suspense (`use(thenable)`). Once the stream is fully resolved, this component performs the stylesheet logic.

The core of this phase is looking up the CSS dependencies for every script in our `scriptsToBeLoaded` list. To do this, we need a lookup table, or **asset manifest**, that maps a source file like `Button.tsx` to its final CSS output file, like `assets/Button.i9j0k1l2.css`.

This lookup process is different in production and development.

#### Production: Reading a Static Manifest
In a production build, this is straightforward. The client build runs first, generating a `manifest.json` file. When the worker build runs, it can treat this manifest as a static asset. Our runtime code simply imports and reads this JSON file. The manifest contains mappings from source file IDs to their final, hashed CSS asset URLs.

#### Development: Delegating to Vite
In development, we no longer compute a manifest on the fly. The `getManifest()` helper function returns an empty manifest object. The responsibility for handling stylesheets is delegated entirely to Vite's client-side runtime. This means that as the browser loads and executes the JavaScript modules for the page, Vite's client script will see the CSS imports and inject the corresponding styles using `<style>` tags. This is Vite's standard behavior and ensures HMR works correctly, at the cost of causing FOUC on the initial load.

Once the manifest is available (empty in dev, populated in prod), the `RscApp` component can perform its final task.

```tsx
const RscApp = ({ thenable, requestInfo }) => {
  // This suspends until the stream is fully processed and all scripts are discovered.
  const rscVDOM = use(thenable);

  // This code only runs AFTER the `thenable` has resolved.
  const manifest = use(getManifest(requestInfo)); // Simplified for example
  const allStylesheets = new Set<string>();

  for (const scriptId of requestInfo.rw.scriptsToBeLoaded) {
    const css = findCssForModule(scriptId, manifest); // Simplified
    for (const entry of css) {
      allStylesheets.add(entry);
    }
  }

  return (
    <>
      {/*
        In production, we render <link> tags for all discovered stylesheets.
        React 19 hoists these into the <head>, preventing FOUC.
        In development, `allStylesheets` will be empty, and no tags are rendered here.
        Vite will handle style injection on the client side.
      */}
      {Array.from(allStylesheets).map((href) => (
        <link key={href} rel="stylesheet" href={href} precedence="first" />
      ))}
      <div id="hydrate-root">{rscVDOM.node}</div>
    </>
  );
};
```

This architecture separates concerns:
-   **Discovery** is handled by a simple, stateless build transform.
-   **Collection** happens at runtime, using the manifest as a source of truth in production.
-   **Injection** is now environment-aware, using React's `precedence` feature in production and delegating to Vite's standard mechanisms in development.

### A Note on CSS Handling in the SSR Environment

A unique challenge arises from how stylesheet imports are processed in the development server's SSR environment. When a client component imports a CSS file, that import travels through the [SSR Bridge](./ssrBridge.md), which must correctly handle it. If not managed properly, plugins like Tailwind CSS might try to parse transformed JavaScript (from a CSS module) as if it were raw CSS, causing build failures.

This problem is orthogonal to injecting stylesheet links into the `<head>`. It is about ensuring that `import styles from './Button.module.css'` works correctly during server-side rendering, providing the component with the correct class name hashes for the initial HTML.

To solve this, the `ssrBridgePlugin` performs a specific transformation:

1.  **Identifier Transformation:** When resolving a module ID for a stylesheet (e.g., `/src/components/Button.module.css`), the plugin appends a `.js` extension to its virtualized path (e.g., `virtual:rwsdk:ssr:/src/components/Button.module.css.js`). This signals to all subsequent Vite plugins that the module should be treated as JavaScript.

2.  **Specialized Loading:** In the `load` hook, the plugin distinguishes between two types of CSS imports:
    -   For **standard `.css` files**, it returns an empty JavaScript module (`export default {};`). This is because global stylesheets are handled by Vite on the client and do not need to be processed as part of the server-rendered component tree.
    -   For **CSS Modules (`.module.css`)**, it first strips the `.js` suffix from the module ID before calling `devServer.environments.ssr.fetchModule()`. This ensures the original CSS module is fetched and transformed by Vite into its JavaScript object representation. This object, which maps class names to their unique generated hashes, is then returned to the `worker` environment so that server-rendered components receive the correct class names.

This two-pronged approach ensures that CSS dependencies are correctly processed according to their type, preventing downstream errors and allowing seamless integration of styles in the server environment, independent of the strategy for final style injection.

This system relies on [React's ability to automatically hoist `<link>` tags](https://react.dev/reference/react-dom/components/link#special-rendering-behavior) to correctly position the final asset links in the document `<head>`.
