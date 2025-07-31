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
In development, Vite's module graph gives us a direct, one-to-one mapping of a `.css` file to its content. In a production build, however, Vite bundles multiple CSS files into a single, hash-named output file (e.g., `assets/worker-Dc1rrpqn.css`). The standard build manifest (`manifest.json`) maps an *entry point* (like `src/worker.tsx`) to its final CSS bundle, but it loses the crucial information about which original `.module.css` files are contained within that bundle. This makes it impossible to selectively inject only the CSS Modules that were used in a given request.

#### 4. The HMR-FOUC Dilemma (Development Mode)
While solving FOUC in production is the primary goal, we must also preserve Vite's Hot Module Replacement (HMR) in development. Vite's dev server injects CSS via client-side JavaScript using `<style>` tags, which it can then hot-swap. If we solve FOUC by injecting server-rendered `<link>` tags in development, we create a conflict: the browser loads the CSS twice, and Vite's HMR system breaks. We need a solution that prevents FOUC without interfering with HMR.

## The Solution: A Hybrid, Render-Time Discovery System

Our solution is a hybrid system that uses different discovery mechanisms depending on the type of stylesheet, collects them on a per-request basis, and uses an environment-aware injection strategy.

The process has two main phases: **Discovery** (finding out which assets are needed) and **Injection** (rendering the stylesheets).

### Phase 1: Per-Request Asset Discovery

The core of this architecture is the per-request `requestInfo` object. We attach two sets to it:

*   `requestInfo.rw.scriptsToBeLoaded`: Collects the module IDs of all "use client" components used in the request.
*   `requestInfo.rw.usedCssModules`: Collects the module IDs of all server-side CSS Modules used in the request.

These sets are populated at render time using two different "proxying" techniques.

#### A) Discovering Client Scripts
Our system discovers client scripts from two sources: static `<script>` tags in the `Document` and dynamic component usage in the RSC stream.

During the build, a Vite plugin scans `Document.tsx` files. When it finds a `<script>` tag pointing to a client entry point, it injects a small piece of code that adds the script's path to our `scriptsToBeLoaded` set at render time.

```diff
- jsx("script", { src: "/src/client.tsx" })
+ (
+   (requestInfo.rw.scriptsToBeLoaded.add("/src/client.tsx")),
+   jsx("script", { src: "/src/client.tsx" })
+ )
```

For dynamically loaded components ("islands"), our build process transforms all "use client" modules into special proxy-like objects. When React's server renderer accesses a special `$$id` property on these objects, we intercept the access and add the component's module ID to the `scriptsToBeLoaded` set.

#### B) Discovering Server CSS Modules via `Proxy`
For server-side `.module.css` files, we use a similar trick. A Vite plugin wraps the exported `styles` object in a JavaScript `Proxy`.

```javascript
// Conceptual code injected by our Vite plugin for MyComponent.module.css
import { requestInfo } from "rwsdk/requestInfo/worker";
const originalStyles = { "myClass": "MyComponent_myClass__a1b2c" };
const moduleId = "/src/components/MyComponent.module.css";

export default new Proxy(originalStyles, {
  get(target, prop, receiver) {
    // When code asks for styles.myClass, this `get` trap fires.
    if (requestInfo.rw) { // Check that we are inside a request
      requestInfo.rw.usedCssModules.add(moduleId);
    }
    return Reflect.get(target, prop, receiver);
  }
});
```
When a component accesses a class name (e.g., `className={styles.myClass}`), the proxy's `get` handler fires, adding the module's ID to the `usedCssModules` set. This tells us exactly which CSS Modules are needed for this specific request.

#### C) Handling Global Styles
For standard `.css` files (not modules), we cannot track usage. These are treated as global.
*   **Client Global CSS**: Any `.css` file imported by a "use client" script will be discovered when we process the `scriptsToBeLoaded` set.
*   **Server Global CSS**: Any `.css` file imported by server code is discovered by analyzing the dependency graph of the main server entry point (`worker.tsx`). These are collected and injected into every document.

### Phase 2: Unified Stylesheet Injection

Once the RSC stream is fully processed, a component called `<Stylesheets />` performs the final injection logic.

1.  **Gather All Stylesheets**: It reads the `scriptsToBeLoaded` and `usedCssModules` sets from `requestInfo`, and also gets the list of global server CSS.
2.  **Consult the Manifest**: It uses a manifest to look up the final output CSS file for every collected module ID. This is the key to solving the mapping problem.
    *   **In Development**: It calls a virtual `/__rwsdk_manifest` endpoint on the Vite dev server, which dynamically traverses the module graph to build a manifest on-the-fly.
    *   **In Production**: It reads the `ssr-manifest.json` file generated during the worker build. This special manifest provides a direct mapping from each source module (including every `.module.css` file) to its final, bundled CSS output file(s). This solves the production mapping problem.
3.  **Perform Environment-Aware Injection**: It renders the appropriate `<link>` or `<style>` tags based on the environment.

```tsx
const Stylesheets = ({ requestInfo }) => {
  // This code only runs AFTER the RSC stream has resolved.
  const manifest = use(getManifest(requestInfo)); // Simplified for example
  const allStylesheets = new Map<string, string | { url: string; content: string; absolutePath: string; }>();

  // Helper to add stylesheets to the map, deduplicating by URL
  const addStylesheet = (entry) => {
    const url = typeof entry === 'string' ? entry : entry.url;
    if (!allStylesheets.has(url)) {
      allStylesheets.set(url, entry);
    }
  };

  // 1. Add server CSS modules used in this request
  for (const moduleId of requestInfo.rw.usedCssModules) {
    const css = findCssForModule(moduleId, manifest.rsc); // Simplified
    for (const entry of css) { addStylesheet(entry); }
  }

  // 2. Add client CSS used in this request
  for (const scriptId of requestInfo.rw.scriptsToBeLoaded) {
    const css = findCssForModule(scriptId, manifest.client); // Simplified
    for (const entry of css) { addStylesheet(entry); }
  }

  return (
    <>
      {Array.from(allStylesheets.values()).map((entry) => {
        // In development, render <style> tag for HMR compatibility.
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

This architecture solves all our challenges: FOUC is prevented because the styles are present in the initial server-rendered HTML, HMR is preserved through environment-aware injection, and server-side CSS is handled efficiently on a per-request basis by leveraging the SSR manifest in production.
