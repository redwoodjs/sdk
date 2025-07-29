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

This is the final, unified step. The component that wraps the RSC stream (`RscApp` in our conceptual example) waits for the entire stream to be processed using React Suspense (`use(thenable)`). Once the stream is fully resolved, this component performs the stylesheet logic.

The core of this phase is looking up the CSS dependencies for every script in our `scriptsToBeLoaded` list. To do this, we need a lookup table, or **asset manifest**, that maps a source file like `Button.tsx` to its final CSS output file, like `assets/Button.i9j0k1l2.css`.

However, this manifest only exists in a production build. In development, this information lives inside Vite's live module graph. This creates an environment mismatch that must be resolved. We solve it with a runtime helper function, `getManifest()`, which abstracts away the difference:
-   In **production**, it returns the static `manifest.json` object that was generated during the client build.
-   In **development**, it makes a `fetch` call to a local Vite dev server endpoint (`/__rwsdk_manifest`) that computes the manifest on the fly from the module graph.

Once `getManifest()` has provided the appropriate manifest for the environment, the `RscApp` component can perform its final task:
1.  It iterates over the complete `requestInfo.rw.scriptsToBeLoaded` set.
2.  For each script ID, it walks the asset manifest to find all of its dependent CSS files.
3.  It collects all unique stylesheet URLs into a final list.
4.  It renders the final `<link>` tags.

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

We then rely on a standard behavior of React's streaming renderer, as documented on [react.dev](https://react.dev/reference/react-dom/components/link#special-rendering-behavior). React automatically detects `<link>` components rendered anywhere in the tree and ensures they are hoisted into the document's `<head>` in the final HTML stream. This allows us to inject links as they are discovered without blocking the stream, preventing any Flash of Unstyled Content (FOUC).

This architecture separates concerns:
-   **Discovery** is handled by a simple, stateless build transform.
-   **Collection** happens at runtime, using the manifest as a source of truth.
-   **Injection** is delegated entirely to React's standard, predictable rendering behavior.
