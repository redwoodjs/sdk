# Architecture: Unified Stylesheet Handling

**Goal:** Allow developers to import stylesheets (`.css` and `.module.css`) in both server and client components and have them injected correctly and efficiently, without causing a Flash of Unstyled Content (FOUC).

## The Core Problem: Asset Discovery in a Streaming, Server-First World

In a traditional Vite-based Single-Page Application (SPA), all roads lead back to a single `index.html` file. Vite uses this static entry point to discover every script and stylesheet needed for the application, making it easy to bundle them and inject the appropriate `<link>` tags into the HTML `<head>`.

Our framework's architecture is fundamentally different, which makes Vite's standard approach unworkable:

1.  **No `index.html`**: We use a dynamic, server-rendered `Document.tsx` component as the HTML shell. This provides developers with full control but removes the static entry point that Vite relies on for asset discovery.
2.  **Server-First Rendering with RSC**: The complete list of components and their dependencies for a given page is not known ahead of time. It is discovered on the server, at request time, as the React Server Component (RSC) stream is rendered.

These architectural choices create a core challenge: **how do we discover all the necessary CSS for a page and get it into the `<head>` *before* we've finished rendering the page?** This problem has several facets.

### The Challenges

#### 1. The HTML Stream Ordering Problem
To prevent a Flash of Unstyled Content (FOUC), all `<link rel="stylesheet">` tags must be placed in the `<head>` of the HTML document. However, the `<head>` is the very first part of the document we send to the browser. We only discover which stylesheets are needed later, as we render the components in the `<body>`. This creates a classic chicken-and-egg problem.

#### 2. The Dynamic Dependency Problem
We don't know the full list of assets for a page ahead of time. Dependencies are revealed dynamically during the render process.

*   **For Client Components ("Islands")**: The RSC stream can decide to render any "use client" component at any time. We only learn that `ChatWindow.tsx` and its associated `ChatWindow.css` are needed for a page when the server actually renders the `<ChatWindow />` component.

*   **For Server CSS Modules**: A similar issue exists for server-only components. A request to `/` might render `HomePage.tsx`, which uses `HomePage.module.css`. A request to `/about` might render `AboutPage.tsx` with `AboutPage.module.css`. Globally injecting both stylesheets on every page would be inefficient and lead to bloat. We need a way to know which server-side CSS Modules are actually used for the current request.

#### 3. The Production Build Mapping Problem
In development, Vite's module graph gives us a direct, one-to-one mapping of a `.css` file to its content. In a production build, however, Vite bundles multiple CSS files into a single, hash-named output file (e.g., `assets/worker-Dc1rrpqn.css`). We need a reliable way to map each original `.module.css` file to its final, bundled CSS output to support selective injection.

#### 4. The Build-Time vs. Runtime Data Problem
The final asset manifest (which contains the mapping of all source files to their output bundles) is only fully known at the very end of the build process. However, our runtime code needs access to this manifest to function. Using standard `import` mechanisms (even virtual ones) creates a timing conflict, as the `import` is resolved during the build, long before the manifest has been finalized.

#### 5. The HMR-FOUC Dilemma (Development Mode)
While solving FOUC in production is the primary goal, we must also preserve Vite's Hot Module Replacement (HMR) in development. Vite's dev server injects CSS via client-side JavaScript using `<style>` tags, which it can then hot-swap. If we solve FOUC by injecting server-rendered `<link>` tags in development, we create a conflict: the browser loads the CSS twice, and Vite's HMR system breaks. We need a solution that prevents FOUC without interfering with HMR.

## The Solution: A Hybrid System with Post-Build Injection

Our solution is a hybrid system that uses different discovery mechanisms depending on the type of stylesheet, collects them on a per-request basis, and uses an environment-aware injection strategy. The key to solving the timing conflict is to inject the final manifest into the worker bundle *after* the build is complete.

### Phase 1: Per-Request Asset Discovery
The core of this architecture is the per-request `requestInfo` object. We attach two sets to it:

*   `requestInfo.rw.scriptsToBeLoaded`: Collects the module IDs of all "use client" components used in the request.
*   `requestInfo.rw.usedCssModules`: Collects the module IDs of all server-side CSS Modules used in the request.

These sets are populated at render time using two different "proxying" techniques.

#### A) Discovering Client Scripts
Our system discovers client scripts from two sources: static `<script>` tags in the `Document` and dynamic component usage in the RSC stream. During the build, a Vite plugin scans `Document.tsx` files and transforms "use client" modules into proxy-like objects to track their usage.

#### B) Discovering Server CSS Modules via `Proxy`
For server-side `.module.css` files, we use a similar trick. A Vite plugin wraps the exported `styles` object in a JavaScript `Proxy`. When a component accesses a class name (e.g., `className={styles.myClass}`), the proxy's `get` handler fires, adding the module's ID to the `usedCssModules` set.

#### C) Handling Global Styles
For standard `.css` files (not modules), we cannot track usage. These are treated as global and are discovered by analyzing the dependency graph of the main server entry point (`worker.tsx`).

### Phase 2: Manifest Handling and Injection

Once assets are discovered, we need to find their final paths and inject them. The manifest handling differs significantly between development and production.

#### A) Manifest Handling in Development
In development, we don't have a timing problem. We use a middleware endpoint (`/__rwsdk_manifest`) on the Vite dev server. The `<Stylesheets />` component fetches this endpoint. The middleware dynamically traverses Vite's module graph for both the client and worker environments to build a complete manifest on-the-fly for the current request.

#### B) Manifest Handling in Production: Post-Build Injection
In production, we solve the build-time vs. runtime data problem with a post-build injection strategy:

1.  **Placeholder in Runtime**: In our runtime code, we define a global variable that will hold the manifest. This variable is just a placeholder.
    ```typescript
    // In our runtime's manifest-loading code
    declare const __RWS_MANIFEST_PLACEHOLDER__: string;
    const manifest = JSON.parse(__RWS_MANIFEST_PLACEHOLDER__);
    ```

2.  **Generate All Manifests**: We run the Vite build as usual. This generates the client manifest, the worker manifest, and our custom `rsc-css-map.json` (which maps source `.module.css` files to their final output bundles).

3.  **Inject via `writeBundle` Hook**: A dedicated Vite plugin (`manifestPlugin`) uses the `writeBundle` hook, which is guaranteed to run *after* all other build steps are complete and the final worker bundle has been written to disk. In this hook, the plugin:
    a. Reads the final worker bundle file (e.g., `dist/worker/worker.js`).
    b. Reads the contents of the client manifest, worker manifest, and the `rsc-css-map.json`.
    c. Assembles these into a single, complete manifest object.
    d. Performs a string replacement on the worker bundle's content, replacing `"__RWS_MANIFEST_PLACEHOLDER__"` with the `JSON.stringify`'d manifest object.
    e. Overwrites the worker bundle file with the modified content.

This "post-processing" step ensures the full, correct manifest is embedded directly into the production worker code without any timing conflicts.

### Phase 3: Unified Stylesheet Injection (Runtime)
Once the manifest is available (either injected in production or fetched dynamically in development), the `<Stylesheets />` component performs the final injection logic.

```tsx
const Stylesheets = ({ requestInfo }) => {
  // In production, `manifest` is now available from the injected global.
  // In development, it's fetched from the dev server.
  const manifest = use(getManifest(requestInfo)); // Simplified for example
  
  const seenUrls = new Set<string>();
  const uniqueStylesheets = [];

  // ... logic to gather and deduplicate stylesheets from manifest ...

  return (
    <>
      {uniqueStylesheets.map((entry) => {
        // In development, render <style> tag for HMR compatibility.
        // This solves the HMR-FOUC dilemma.
        if (import.meta.env.VITE_IS_DEV_SERVER && typeof entry === 'object') {
          return (
            <style
              data-vite-dev-id={entry.absolutePath}
              dangerouslySetInnerHTML={{ __html: entry.content }}
              key={entry.url}
            />
          );
        }

        // In production, render a standard <link> tag.
        const href = typeof entry === 'string' ? entry : entry.url;
        return <link key={href} rel="stylesheet" href={href} precedence="first" />;
      })}
    </>
  );
};
```

This architecture solves all our challenges: FOUC is prevented, HMR is preserved, server-side CSS is handled efficiently, and the build-time vs. runtime conflict is resolved through a robust, self-contained post-build injection process.
