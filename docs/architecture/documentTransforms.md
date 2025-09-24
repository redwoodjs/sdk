# Document Component Transformations

This document details the various automated transformations applied to `Document` components. These transformations are crucial for bridging the gap between developer-friendly source code and optimized, secure, production-ready HTML.

## The Challenge: From Source to Production

In our framework, developers define the entire HTML shell using a React component, typically `src/app/Document.tsx`. This provides great power and flexibility, but it also introduces a significant architectural challenge: balancing our philosophy of user control with the technical requirements of a modern React framework.

However, the source code of a `Document` component is not what can be served directly to a user's browser, especially in a production environment. It contains several elements that need to be processed:

1.  **The Hydration Ordering Problem:** For `React.useId` to work correctly, React must inject a hydration "marker" script *before* the main client entry script is loaded. This means React needs to control the rendering of the entry point. However, our philosophy dictates that the user should explicitly place this script in their `Document`. This creates a direct conflict: how can React control a script that the user has placed?
2.  **Development-Time Paths**: Script tags like `<script src="/src/client.tsx">` point to raw source files. In production, these need to point to the final, bundled, and hashed asset files (e.g., `/assets/client.a1b2c3d4.js`).
3.  **Missing Stylesheet Links**: As detailed in our [Client-Side Stylesheets architecture](./clientStylesheets.md), stylesheets are imported directly into client components. The `Document` is not initially aware of these dependencies and needs to have the corresponding `<link>` tags injected.
4.  **Security Concerns**: For a secure application, script tags should use a [Content Security Policy (CSP)](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP) nonce to prevent the execution of unauthorized, injected scripts. This nonce is generated per-request and must be added to every legitimate script.

Manually managing these details would be tedious and error-prone. The challenge is to automate this transformation process reliably while preserving the transparent, user-controlled nature of the `Document` component.

## The Solution: AST Transformation

Our solution is a dedicated Vite plugin, [`transformJsxScriptTagsPlugin.mts`](https://github.com/redwoodjs/sdk/blob/90679fbeee4af5cc2d026a42475432278d53ef55/sdk/src/vite/transformJsxScriptTagsPlugin.mts), that operates by parsing the `Document` component's source code into an Abstract Syntax Tree (AST). This allows us to programmatically understand and safely modify the code's structure.

The plugin inspects the AST for specific JSX elements (`<script>` and `<link>`) and applies transformations to support server-side rendering, asset bundling, and security best practices.

### Key Transformations

#### 1. Entry Point Handling, Hydration, and Asset Rewriting

To solve the hydration ordering problem, the plugin finds the user's client entry point `<script>` tag in the AST. It then performs a critical transformation: it removes the script tag from the `Document`'s code and replaces it with a server-side side-effect. This side-effect passes the script's information (its path or inline content) to the runtime via the `requestInfo` object.

Later, during the server render, the runtime uses this information to instruct React (via the `bootstrapModules` or `bootstrapScriptContent` options) to render the entry script itself. This elegantly resolves the conflict: the user still declares the entry point in their `Document.tsx`, but at build time, that declaration is converted into a command for React, which then correctly handles the low-level injection and ordering at runtime.

This same transformation also handles the discovery of client entry points for the production build, which involves rewriting asset paths to a placeholder format that is later replaced by the linker.

#### 2. Security Nonce Injection

To enhance security, the plugin automatically injects a `nonce` attribute into every `<script>` tag that doesn't have one and isn't inherently unsafe (e.g., using `dangerouslySetInnerHTML`).

The nonce value is set to a placeholder expression that references a `requestInfo` object available at runtime. If this `requestInfo` object is not already imported in the `Document`, the plugin will also add the necessary `import` statement at the top of the file. This ensures that every server-rendered script is tagged with the per-request CSP nonce, mitigating XSS risks.

### Important Design Considerations

#### Performance: Early Exit for Unrelated Files

Parsing source code into an AST is a relatively expensive operation. Running this transformation on every file processed by Vite—including files that contain no JSX or have no `<script>` or `<link>` tags—would introduce a significant performance overhead during development and builds.

To mitigate this, the plugin first performs a quick, lightweight check on the raw source code. It uses a simple string search to look for keywords that indicate the presence of a transpiled `<script>` or `<link>` element (e.g., `jsx("script"`, `jsxs("link"`).

If none of these keywords are found, the plugin exits immediately, skipping the expensive AST parsing and transformation steps entirely for that file. This optimization ensures that the plugin has a negligible performance impact on the vast majority of files in a project that do not require this specific transformation. 