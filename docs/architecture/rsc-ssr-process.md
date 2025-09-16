# Architecture: RSC to HTML Rendering

This document outlines the process of transforming a React Server Components (RSC) render into a final HTML document suitable for an initial page load.

## The Challenge: Bridging Two Runtimes

The framework's architecture involves rendering React Server Components (RSC) and then using a traditional Server-Side Render (SSR) to generate the final HTML. Both of these operations must occur within the same Cloudflare Worker, but they have conflicting dependency requirements.

The RSC and SSR runtimes require different builds of React and its dependencies. This is typically managed by a `package.json` conditional export called `"react-server"`. An RSC-compatible build uses packages that respect this condition, while a standard SSR build does not. A single Vite environment cannot be configured to handle both sets of dependency requirements simultaneously, creating a bundling challenge that must be solved at build time.

## The Solution: A Two-Phase Render via SSR Bridge

The solution is a two-phase process that leverages two separate Vite environments—`worker` for RSC and `ssr` for traditional SSR—connected by a mechanism called the **SSR Bridge**.

### Phase 1: Render to RSC Payload

The first phase is a standard RSC render that occurs entirely within the `worker` environment. The application's component tree is rendered into the RSC payload format, which is a serialized representation of the UI with placeholders for any Client Components.

### Phase 2: SSR Render from the RSC Payload

The second phase takes the RSC payload from Phase 1 and renders it to an HTML stream. This step is conceptually similar to how a client browser would process the payload, but it runs on the server.

This is where the SSR Bridge comes in. The `worker` environment passes the RSC payload to the `ssr` environment through the bridge. The `ssr` environment, which is configured with a standard React runtime, then parses the payload. When it encounters a Client Component placeholder, it loads the component's code and renders it to HTML using a traditional server-side React DOM renderer.

The final output is a complete HTML document, with both Server and Client Components fully rendered, which is streamed back to the browser. This approach allows the framework to correctly handle the conflicting dependency requirements of the two runtimes within a single deployment, providing the fastest possible initial page load while setting the stage for client-side hydration.
