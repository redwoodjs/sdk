# Document Component Transformations

This document details the various automated transformations applied to `Document` components. These transformations are crucial for bridging the gap between developer-friendly source code and optimized, secure, production-ready HTML.

## The Challenge: From Source to Production

In our framework, developers define the entire HTML shell using a React component, typically `src/app/Document.tsx`. This provides great power and flexibility, as explained in the [guides for creating Documents](./guides/frontend/documents.mdx).

However, the source code of a `Document` component is not what can be served directly to a user's browser, especially in a production environment. It contains several elements that need to be processed:

1.  **Development-Time Paths**: Script tags like `<script src="/src/client.tsx">` point to raw source files. In production, these need to point to the final, bundled, and hashed asset files (e.g., `/assets/client.a1b2c3d4.js`).
2.  **Missing Stylesheet Links**: As detailed in our [Client-Side Stylesheets architecture](./clientStylesheets.md), stylesheets are imported directly into client components. The `Document` is not initially aware of these dependencies and needs to have the corresponding `<link>` tags injected.
3.  **Security Concerns**: For a secure application, script tags should use a [Content Security Policy (CSP)](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP) nonce to prevent the execution of unauthorized, injected scripts. This nonce is generated per-request and must be added to every legitimate script.

Manually managing these details would be tedious and error-prone. The challenge is to automate this transformation process reliably for both development and production builds.

## The Solution: AST Transformation

Our solution is a dedicated Vite plugin, [`transformJsxScriptTagsPlugin.mts`](https://github.com/redwoodjs/sdk/blob/90679fbeee4af5cc2d026a42475432278d53ef55/sdk/src/vite/transformJsxScriptTagsPlugin.mts), that operates by parsing the `Document` component's source code into an Abstract Syntax Tree (AST). This allows us to programmatically understand and safely modify the code's structure.

The plugin inspects the AST for specific JSX elements (`<script>` and `<link>`) and applies several transformations in a single pass.

### Key Transformations

#### 1. Client Entry Point Discovery

To support automatic stylesheet injection, the framework first needs to discover all client-side JavaScript entry points for a given page. The transformation plugin is responsible for this discovery.

Instead of directly injecting `<link>` tags, the plugin modifies the AST to inject a small piece of code—a side effect—that runs on the server during rendering. This code adds the module ID of each discovered client entry point to a shared list (`requestInfo.rw.scriptsToBeLoaded`).

The plugin finds these entry points in two ways:
- **`src` attribute**: A `<script src="/src/client.tsx">` tag is transformed to register its `src` path before it is rendered.
- **Inline `import()`**: A dynamic `import('/src/client.tsx')` inside an inline `<script>` tag is also detected, and the registration logic is prepended to the script's content.

This process ensures that by the time the final HTML is ready to be streamed, a complete list of all necessary client scripts has been collected. A separate runtime mechanism then uses this list to look up all associated CSS dependencies and inject the final `<link rel="stylesheet">` tags into the document `<head>`.

For a detailed explanation of the end-to-end stylesheet handling mechanism, see the [Supporting Client-Side Stylesheet Imports](./clientStylesheets.md) architecture document.

#### 2. Asset Path Rewriting (Production Builds)

During a production `build`, all references to client-side assets must be updated to point to their final, hashed filenames. The plugin inspects both `src` attributes on `<script>` tags and dynamic `import()` calls within inline scripts, rewriting their paths by consulting the Vite build manifest.

This transformation applies to:

-   `<script>` tags: `<script src="/src/client.tsx">` becomes `<script src="/assets/client.a1b2c3d4.js">`.
-   Preload links: `<link rel="modulepreload" href="/src/client.tsx">` is similarly transformed.
-   Inline script imports: Dynamic `import()` calls are also found and rewritten.

This ensures that all asset links in the final HTML are valid and point to the optimized production bundles.

#### 3. Security Nonce Injection

To enhance security, the plugin automatically injects a `nonce` attribute into every `<script>` tag that doesn't have one and isn't inherently unsafe (e.g., using `dangerouslySetInnerHTML`).

The nonce value is set to a placeholder expression that references a `requestInfo` object available at runtime. If this `requestInfo` object is not already imported in the `Document`, the plugin will also add the necessary `import` statement at the top of the file. This ensures that every server-rendered script is tagged with the per-request CSP nonce, mitigating XSS risks.

### Important Design Considerations

#### Performance: Early Exit for Unrelated Files

Parsing source code into an AST is a relatively expensive operation. Running this transformation on every file processed by Vite—including files that contain no JSX or have no `<script>` or `<link>` tags—would introduce a significant performance overhead during development and builds.

To mitigate this, the plugin first performs a quick, lightweight check on the raw source code. It uses a simple string search to look for keywords that indicate the presence of a transpiled `<script>` or `<link>` element (e.g., `jsx("script"`, `jsxs("link"`).

If none of these keywords are found, the plugin exits immediately, skipping the expensive AST parsing and transformation steps entirely for that file. This optimization ensures that the plugin has a negligible performance impact on the vast majority of files in a project that do not require this specific transformation. 