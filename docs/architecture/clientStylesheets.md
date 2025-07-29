# Architecture: Supporting Client-Side Stylesheet Imports

**Goal:** Allow developers to `import './styles.css'` inside a "use client" component and have it "just work," without causing a Flash of Unstyled Content (FOUC).

## The Core Problem: Discovering Dynamic Dependencies in a Streaming World

### Why Vite's Default Behavior Isn't Enough
In a standard Vite-based Single-Page Application (SPA), stylesheet handling is managed through a well-defined process.
- In **development**, Vite serves an `index.html` file. When the browser requests a JavaScript module that imports a CSS file, Vite intercepts the import, injects the styles via a `<style>` tag, and enables Hot Module Replacement (HMR).
- In **production**, Vite uses the `index.html` file as the entry point. During the build, it scans all the JavaScript modules linked from that HTML file, finds their CSS imports, bundles the CSS into files, and automatically injects the final `<link>` tags back into the `index.html`.

Our framework's architecture makes this standard approach impossible for two main reasons:
1.  **No `index.html`:** We use a dynamic, server-rendered `Document.tsx` component as the HTML shell. This gives developers full control, but it means Vite has no static entry point to analyze.
2.  **React Server Components (RSC):** The full list of components (and therefore their CSS dependencies) is not known upfront. It is discovered dynamically as the RSC stream is rendered on the server.

Because of these architectural choices, we cannot rely on Vite's built-in mechanisms. We must build a system that can discover all static and dynamic CSS dependencies during a server-side render and ensure the necessary `<link>` tags are injected into the final HTML `<head>`. This leads to a specific set of challenges.

### The Challenges
1.  **The HTML Stream Ordering Problem:** To avoid a Flash of Unstyled Content (FOUC), all `<link rel="stylesheet">` tags for a page must be in the `<head>`. However, the `<head>` is the very first part of the HTML document sent to the browser, long before we have processed the server components that would tell us which CSS to include.

2.  **The Server Evaluation Ordering Problem:** In development, the Vite dev server does not know a client module's full dependency graph until that module is requested and evaluated. When a server request comes in, our worker code needs to know the CSS dependencies for client scripts so that we can put the `<links>`s in the head instead of adding them dynamically and ending up with a Flash of Unstyled Content (FOUC). But at that exact moment, the Vite `client` environment has not yet evaluated those scripts, so their CSS dependencies are not yet discoverable in the client module graph.

3.  **The Render-Time Discovery Problem:** We don't know the full list of components for a page ahead of time. As the RSC stream is rendered on the server, it can dynamically decide to include new "use client" components (islands). If `ComponentA` imports `./styles.css`, we only discover that this stylesheet is needed when `ComponentA` is actually rendered. Our build process transforms all "use client" modules into calls to a `registerClientReference` function at module-load time, which gives us a complete list of all *potential* client components that could be used. However, we have no way of knowing which ones are *actually* used in a specific request until render time. Preventing FOUC requires a render-time hook to know precisely which components are being rendered, but React's server-side rendering APIs do not provide a public hook for this.

4.  **The Entry Point Discovery Problem:** The framework has no built-in knowledge of the main client-side entry point (e.g., `<script src="/src/client.tsx">`). This script is referenced inside the developer's `Document.tsx` file, and we need a way to find it so we can also find *its* CSS dependencies.

We cannot simply pause rendering to find all these dependencies, as that would eliminate the benefits of streaming. We need a system that can discover all these scripts—both the static entry points and the dynamically loaded components—and then use that complete list to inject all the necessary `<link>` tags into the `<head>` just in time.

#### The HMR-FOUC Dilemma in Development

While injecting `<link>` tags on the server solves FOUC in production, it creates a new problem in the development environment: it conflicts with Vite's own Hot Module Replacement (HMR) system.

Vite's dev server is designed to manage CSS updates on the client. When a JavaScript module imports a CSS file, Vite's client-side runtime injects the styles using a `<style>` tag, which it can then hot-swap when the file changes. If we pre-inject a `<link>` tag on the server, the browser loads the stylesheet twice—once from our tag and once from Vite's.

This leads to a dilemma:
- If we use `<link>` tags, we get duplicated styles and interfere with HMR.
- If we *don't* use `<link>` tags, we get a Flash of Unstyled Content (FOUC) because the styles are only injected after the client-side JavaScript loads and executes.

To solve this, we cannot simply disable one of the injection methods. We need a solution that provides the initial styles on the server to prevent FOUC while still allowing Vite's HMR to function correctly on the client.

## The Solution: A Unified Discovery and Environment-Aware Injection Process

Our solution is to create a single, unified set of all client-side scripts that will be loaded on the page. By collecting every script module ID first, we can then, in a single final step, look up all their combined CSS dependencies and inject them in an environment-aware manner.

This process has two main phases: **Discovery** (populating the list of scripts) and **Injection** (finding and rendering their stylesheets).

### Phase 1 (Runtime): Unified Script Discovery

The core of this architecture is a single `Set` on the per-request `requestInfo` object: `requestInfo.rw.scriptsToBeLoaded`. This set collects the module IDs of every client script that is needed for the current page render.

This set is populated from two different sources at two different times, allowing us to capture all scripts, both static and dynamic:

**A) Static Entry Points from the `Document`**

During the build, a simple Vite plugin scans `Document.tsx` files. When it finds a `<script>` tag that looks like a client entry point (e.g., `<script src="/src/client.tsx">`), it injects a tiny, stateless piece of code. This code runs on the server during the `Document` render and performs a side effect: it adds the entry point's path to our `scriptsToBeLoaded` set.

```diff
- jsx("script", { src: "/src/client.tsx" })
+ (
+   (requestInfo.rw.scriptsToBeLoaded.add("/src/client.tsx")),
+   jsx("script", { src: "/src/client.tsx" })
+ )
```

**B) Dynamic Components from the RSC Stream**

As the RSC stream renders, it may dynamically load other client components ("islands"). Our build process transforms all "use client" modules into calls to a `registerClientReference` function. This function wraps the client component in a proxy-like object.

When React's server renderer encounters one of these objects, it accesses a special `$$id` property on it to identify the component and serialize it for the client. We intercept the getter for this specific property. The first time the `$$id` property is accessed on a client component's reference during a render, we know that component is being used on the page. At that exact moment, we add the component's module ID to the `scriptsToBeLoaded` set. This gives us a precise, render-time mechanism for discovering exactly which components are needed for the current page without introducing any performance overhead.

At the end of these two steps, `requestInfo.rw.scriptsToBeLoaded` contains a complete list of every client module required to render the page.

### Phase 2 (Runtime): Unified Stylesheet Injection

This is the final, unified step. The component that wraps the RSC stream (`RscApp` in our conceptual example) waits for the entire stream to be processed using React Suspense (`use(thenable)`). Once the stream is fully resolved, this component performs the stylesheet logic.

The core of this phase is looking up the CSS dependencies for every script in our `scriptsToBeLoaded` list. To do this, we need a lookup table, or **asset manifest**, that maps a source file like `Button.tsx` to its final CSS output file, like `assets/Button.i9j0k1l2.css`.

This lookup process is different in production and development.

#### Production: Reading a Static Manifest
In a production build, this is straightforward. The client build runs first, generating a `manifest.json` file. When the worker build runs, it can treat this manifest as a static asset. Our runtime code simply imports and reads this JSON file. The manifest contains mappings from source file IDs to their final, hashed CSS asset URLs.

#### Development: Computing the Manifest and Styles On-the-Fly
In development, no static manifest exists. Dependency information lives in Vite's live, in-memory **module graph**. This presents two challenges:
1.  The worker runs in a sandboxed process and cannot access the main Vite server's memory to read the graph.
2.  The Vite dev server itself maintains separate module graphs for each of its "environments" (e.g., `client`, `ssr`, `worker`). A module imported in the `worker` environment is not automatically present in the `client` graph.

We solve this with a runtime helper, `getManifest()`, and a development-only endpoint.
-   The `getManifest()` function, when running in dev, makes a `fetch` call to a local endpoint (`/__rwsdk_manifest`).
-   The endpoint handler, running inside the main Vite server process, receives a list of script module IDs.
-   For each script, it uses `server.environments.client.transformRequest()` to ensure the module is processed by the client environment's plugin pipeline. This correctly populates the client module graph.
-   It then inspects `server.environments.client.moduleGraph` to find the module and all its imported dependencies.
-   Finally, it constructs a manifest-like JSON object and returns it to the worker's `fetch` call. Crucially, for each CSS dependency, this manifest includes not only its URL but also its **full text content** and its **absolute file path**.

Once `getManifest()` has provided the appropriate manifest for the environment, the `RscApp` component can perform its final task. The injection logic is now environment-specific.

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
      {Array.from(allStylesheets).map((entry) => {
        // In development, we render a <style> tag with the CSS content.
        // The `data-vite-dev-id` attribute is the key that allows Vite's HMR
        // client to find and manage this style tag.
        if (import.meta.env.VITE_IS_DEV_SERVER && typeof entry === 'object') {
          return (
            <style
              data-vite-dev-id={entry.absolutePath}
              dangerouslySetInnerHTML={{ __html: entry.content }}
              key={entry.url}
            />
          );
        }

        // In production, we render a standard <link> tag.
        const href = typeof entry === 'string' ? entry : entry.url;
        return <link key={href} rel="stylesheet" href={href} precedence="first" />;
      })}
      <div id="hydrate-root">{rscVDOM.node}</div>
    </>
  );
};
```

We then rely on a standard behavior of React's streaming renderer. React automatically detects `<link>` and `<style>` components rendered anywhere in the tree and ensures they are hoisted into the document's `<head>` in the final HTML stream. This allows us to inject stylesheets as they are discovered without blocking the stream, preventing any Flash of Unstyled Content (FOUC). In development, this approach gives Vite's client-side HMR script the exact `<style>` tag it needs to take over, solving the FOUC-HMR dilemma.

This architecture separates concerns:
-   **Discovery** is handled by a simple, stateless build transform.
-   **Collection** happens at runtime, using the manifest as a source of truth.
-   **Injection** is now environment-aware, delegating to React's standard rendering behavior while supporting Vite's HMR in development.

### A Note on CSS Handling in the SSR Environment

A unique challenge arises from how stylesheet imports are processed in the development server's SSR environment. When a client component imports a CSS file, that import travels through the [SSR Bridge](./ssrBridge.md), which must correctly handle it. If not managed properly, plugins like Tailwind CSS might try to parse transformed JavaScript (from a CSS module) as if it were raw CSS, causing build failures.

To solve this, the `ssrBridgePlugin` performs a specific transformation:

1.  **Identifier Transformation:** When resolving a module ID for a stylesheet (e.g., `/src/components/Button.module.css`), the plugin appends a `.js` extension to its virtualized path (e.g., `virtual:rwsdk:ssr:/src/components/Button.module.css.js`). This signals to all subsequent Vite plugins that the module should be treated as JavaScript.

2.  **Specialized Loading:** In the `load` hook, the plugin distinguishes between two types of CSS imports:
    -   For **standard `.css` files**, it returns an empty JavaScript module (`export default {};`). This is because global stylesheets are injected directly into the `<head>` and do not need to be processed as part of the server-rendered component tree.
    -   For **CSS Modules (`.module.css`)**, it first strips the `.js` suffix from the module ID before calling `devServer.environments.ssr.fetchModule()`. This ensures the original CSS module is fetched and transformed by Vite into its JavaScript object representation. This object, which maps class names to their unique generated hashes, is then returned to the `worker` environment so that server-rendered components receive the correct class names.

This two-pronged approach ensures that CSS dependencies are correctly processed according to their type, preventing downstream errors and allowing seamless integration of styles in the server environment.
