# Architecture: Unified Script Discovery

The core of our client-side asset handling is a single `Set` on the per-request `requestInfo` object: `requestInfo.rw.scriptsToBeLoaded`. This set collects the module IDs of every client script that is needed for the current page render.

This mechanism is fundamental to both [Client-Side Stylesheet Imports](./clientStylesheets.md) and [Preloading Client-Side Scripts](./preloading.md), as it provides a single source of truth for all client-side JavaScript dependencies discovered during a server-side render.

This set is populated from two different sources at two different times, allowing us to capture all scripts, both static and dynamic:

**A) Static Entry Points from the `Document`**

A core architectural challenge is balancing the need for React to control the client entry script for hydration purposes against our philosophy of having the user explicitly declare that script in their `Document.tsx`. Our build-time transformation is the bridge that resolves this conflict.

During the build, our `transformJsxScriptTagsPlugin` scans `Document.tsx` files. When it finds a `<script>` tag that acts as the main client entry point (either via a `src` attribute or an inline `import()`), it removes the script tag from the AST and replaces it with a server-side side-effect. This side-effect populates one of two new sets on the `requestInfo` object: `entryScripts` for external scripts or `inlineScripts` for inline ones.

For example, a script tag is transformed at build time like this:

```diff
- jsx("script", { src: "/src/client.tsx" })
+ (
+   (requestInfo.rw.entryScripts.add("/src/client.tsx")),
+   (requestInfo.rw.scriptsToBeLoaded.add("/src/client.tsx")),
+   null
+ )
```

And a similar transformation is applied for inline scripts:

```diff
- jsx("script", { children: "import('/src/client.tsx')" })
+ (
+   (requestInfo.rw.inlineScripts.add("import('/src/client.tsx')")),
+   (requestInfo.rw.scriptsToBeLoaded.add("/src/client.tsx")),
+   null
+ )
```

This process allows the runtime to delegate the rendering of the entry script to React, which is critical for solving hydration issues, while still discovering the entry point at build time. The entry point is also added to the `scriptsToBeLoaded` set for dependency tracking.

**B) Dynamic Components from the RSC Stream**

As the RSC stream renders, it may dynamically load other client components ("islands"). Our build process transforms all "use client" modules into calls to a `registerClientReference` function. This function wraps the client component in a proxy-like object.

When React's server renderer encounters one of these objects, it accesses a special `$$id` property on it to identify the component and serialize it for the client. We intercept the getter for this specific property. The first time the `$$id` property is accessed on a client component's reference during a render, we know that component is being used on the page. At that exact moment, we add the component's module ID to the `scriptsToBeLoaded` set. This gives us a precise, render-time mechanism for discovering exactly which components are needed for the current page without introducing any performance overhead.

At the end of these two steps, `requestInfo.rw.scriptsToBeLoaded` contains a complete list of every client module required to render the page.
