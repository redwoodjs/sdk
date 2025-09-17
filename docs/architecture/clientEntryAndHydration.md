# Architecture: Client Entry and Hydration Strategy

This document outlines the framework's strategy for loading the client-side JavaScript entry point and ensuring fast, reliable hydration in a streaming Server-Side Rendering (SSR) environment.

## The Challenge: Deferred Module Execution

When streaming an HTML response that includes React Server Components (RSC), a significant challenge is ensuring that client components become interactive as quickly as possible. The standard approach for loading JavaScript is to use a module script, like `<script type="module" src="/src/client.tsx">`.

However, by browser specification, module scripts are deferred. This means they do not execute until the entire HTML document has been received and parsed. In a streaming environment, especially one that uses `<Suspense>`, this creates a poor user experience. The initial HTML shell for the page, including interactive elements like a counter, might be sent to the browser immediately, but the JavaScript required to make them functional will not run until the very last chunk of the streamed response (e.g., the content inside the Suspense boundary) has arrived. This results in a visible but non-interactive UI.

## The Solution: Non-Deferred, Preloaded Inline Import

To solve this, the framework adopts a strategy that forces the client-side code to execute as soon as the initial shell is parsed, without waiting for the full stream to complete.

### 1. Inline Dynamic Import
Instead of a deferred module script, the user's `Document.tsx` includes a plain, inline script that uses a dynamic `import()` call:
```html
<script>import("/src/client.tsx")</script>
```
Because this is not a `type="module"` script, the browser executes it as soon as it is parsed. The dynamic import then initiates the fetch and execution of the actual client-side JavaScript module, kicking off the hydration process immediately.

### 2. Module Preloading
To further optimize the process, a `<link rel="modulepreload">` tag is added to the `<head>` of the `Document.tsx`:
```html
<link rel="modulepreload" href="/src/client.tsx" />
```
This serves as a hint to the browser, telling it to start fetching the client entry point's code as early as possible, often in parallel with parsing the rest of the HTML. By the time the inline import script executes, the module is often already downloaded and ready to be executed, minimizing any fetch-related delays.

### 3. Build-Time Transformations
This strategy requires support from the build system to work in production, where asset filenames are typically hashed. A custom Vite plugin programmatically transforms the `Document.tsx` file, rewriting the paths in the `<link>` and `<script>` tags to point to the correct, final asset filenames.

For a complete explanation of the transformation mechanism, see the [Document Component Transformations](./documentTransforms.md) architecture document.

This combination of techniques ensures that client-side hydration begins at the earliest possible moment, providing a fast, interactive experience even on pages that stream large amounts of data.

