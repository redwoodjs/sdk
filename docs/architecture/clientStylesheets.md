# Architecture: Supporting Client-Side Stylesheet Imports

**Goal:** Allow developers to `import './styles.css'` inside a "use client" component and have it "just work," without causing a Flash of Unstyled Content (FOUC).

## The Core Problem: Discovering Dynamic Dependencies in a Streaming World

Our framework uses a server-rendered `Document.tsx` file, giving developers full control over the HTML shell. We also use React Server Components (RSC) to stream the UI, which is great for performance. This combination, however, creates a difficult set of challenges when it comes to stylesheets.

1.  **The Injection Timing Problem:** To avoid a Flash of Unstyled Content (FOUC), all `<link rel="stylesheet">` tags for a page must be in the `<head>`. But the `<head>` is the very first thing sent to the browser, long before we know what all the CSS dependencies are.

2.  **The Dynamic Component Problem:** We don't know the full list of components for a page ahead of time. As the RSC stream is rendered on the server, it can dynamically decide to include new "use client" components (islands). If `ComponentA` imports `./styles.css`, we only discover that this stylesheet is needed when `ComponentA` is actually rendered.

3.  **The Entry Point Discovery Problem:** The framework has no built-in knowledge of the main client-side entry point (e.g., `<script src="/src/client.tsx">`). This script is referenced inside the developer's `Document.tsx` file, and we need a way to find it so we can also find *its* CSS dependencies.

We cannot simply pause rendering to find all these dependencies, as that would eliminate the benefits of streaming. We need a system that can discover all these scripts—both the static entry points and the dynamically loaded components—and then use that complete list to inject all the necessary `<link>` tags into the `<head>` just in time.

## The Solution: A Unified Discovery and Injection Process

Our solution is to create a single, unified set of all client-side scripts that will be loaded on the page. By collecting every script module ID first, we can then, in a single final step, look up all their combined CSS dependencies and inject them.

This process has two main phases: **Discovery** (populating the list of scripts) and **Injection** (finding and rendering their stylesheets).

### Phase 1 (Runtime): Unified Script Discovery

The core of this architecture is a single `Set` on the per-request `requestInfo` object: `requestInfo.rw.scriptsToBeLoaded`. This set collects the mVdule IDs of every client script that is needed for the current page render.

This set is populated from two different sources at two different times, allowing us to capture all scripts, both static and dynamic:

**A) Static Entry Points from the `Document`**

During the build, a simple Vite plugin scans `Document.tsx` files. When it finds a `<script>` tag that looks like a client entry point (e.g., `<script src="/src/client.tsx">`), it injects a tiny, stateless piece of code. This code runs on the server during the `Document` render and performs a side effect: it adds the entry point's path to our `scriptsToBeLoaded` set.

```diff
- jsx("script", { src: "/src/client.tsx" })
+ [
+   (requestInfo.rw.scriptsToBeLoaded.add("/src/client.tsx")),
+   jsx("script", { src: "/src/client.tsx" })
+ ]
```

**B) Dynamic Components from the RSC Stream**

As the RSC stream renders, it may dynamically load other client components ("islands"). Our `__webpack_require__` hook intercepts these loads and adds the module ID of *that specific component* to the very same `scriptsToBeLoaded` set.

At the end of these two steps, `requestInfo.rw.scriptsToBeLoaded` contains a complete list of every client module required to render the page.

### Phase 2 (Runtime): Unified Stylesheet Injection

This is the final, unified step. The component that wraps the RSC stream (`RscApp` in our conceptual example) waits for the entire stream to be processed using React Suspense (`use(thenable)`).

Once the stream is fully resolved, this component performs the stylesheet logic:
1.  It gets the project's asset manifest by calling a runtime helper, `getManifest()`. This function abstracts away the difference between development (fetching from a dev server endpoint) and production (reading a static object).
2.  It iterates over the complete `requestInfo.rw.scriptsToBeLoaded` set.
3.  For each script ID, it walks the asset manifest to find all of its dependent CSS files.
4.  It collects all unique stylesheet URLs into a final list.
5.  It renders the final `<link>` tags. React's streaming renderer automatically hoists these tags into the document's `<head>`, solving the ordering problem.

```tsx
const RscApp = ({ thenable, requestInfo }) => {
  // This suspends until the stream is fully processed and all scripts are discovered.
  const rscVDOM = use(thenable);

  // This code only runs AFTER the `thenable` has resolved.
  const allStylesheets = new Set<string>();
  const manifest = getManifest(); // Simplified for example

  for (const scriptId of requestInfo.rw.scriptsToBeLoaded) {
    const css = findCssForModule(scriptId, manifest); // Simplified
    for (const href of css) {
      allStylesheets.add(href);
    }
  }

  return (
    <>
      {Array.from(allStylesheets).map(href => <link key={href} rel="stylesheet" href={href} />)}
      <div id="hydrate-root">{rscVDOM.node}</div>
    </>
  );
};
```

We rely on a standard behavior of React's streaming renderer, as documented on [react.dev](https://react.dev/reference/react-dom/components/link#special-rendering-behavior). React automatically detects `<link>` components rendered anywhere in the tree and ensures they are hoisted into the document's `<head>` in the final HTML stream. This allows us to inject links as they are discovered without blocking the stream, preventing any Flash of Unstyled Content (FOUC).

### The `getManifest()` Helper

A key piece of this puzzle is the `getManifest()` runtime function. At a high level, its job is to provide a lookup table—known as the **asset manifest**—that our worker can use to find the CSS dependencies for a given JavaScript module.

The asset manifest is a JSON object, generated by Vite during the build, that maps original source file paths to their final browser-loadable output files. Crucially, for each JavaScript module, it also lists all the CSS files that module depends on. A simplified entry looks like this:

```json
{
  "src/components/Button.tsx": {
    "file": "assets/Button.a1b2c3d4.js",
    "css": ["assets/Button.i9j0k1l2.css"]
  }
}
```

The `getManifest()` function's main responsibility is to provide this manifest object to the runtime, but its implementation must change completely between development and production.

**The Challenge: Environment Mismatch**

-   In **production**, the worker runs from a pre-built script. The client asset `manifest.json` file is also available on disk, created during the client build which runs *before* the worker build. The worker can simply read this static file.
-   In **development**, there is no `manifest.json`. Instead, the Vite dev server holds a live, in-memory "module graph" that knows all the dependencies. The worker runs in a separate, sandboxed process and cannot access the Vite server's memory.

**The Solution: An Environment-Aware Helper**

The `getManifest()` function hides this complexity behind a single interface. It uses the `import.meta.env.DEV` flag, which Vite provides, to switch its behavior:

-   In **production** (`import.meta.env.DEV` is false), it imports the static `manifest.json` file directly. We use a simple build-time alias to ensure the path to the manifest is correct without cluttering the runtime code.
-   In **development** (`import.meta.env.DEV` is true), it becomes an async function that makes a `fetch` call to a local endpoint on the Vite server (e.g., `/__rws_manifest`). This endpoint's handler, running inside the Vite process, can access the live module graph, compute a manifest-like object on the fly, and return it to the worker as JSON.

This design allows the rest of our runtime code to remain clean and unaware of the environment-specific details of how the manifest data is obtained.

This architecture separates concerns:
-   **Discovery** is handled by a simple, stateless build transform.
-   **Collection** happens at runtime, using the manifest as a source of truth.
-   **Injection** is delegated entirely to React's standard, predictable rendering behavior.
