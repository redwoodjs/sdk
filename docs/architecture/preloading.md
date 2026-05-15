# Architecture: Preloading Client-Side Scripts

**Goal:** Improve page load performance by preloading client-side JavaScript modules, reducing the impact of the request waterfall.

## The Core Problem: Request Waterfalls in a "use client" World

In a React Server Components (RSC) architecture, the browser's journey to rendering a fully interactive page can involve a series of sequential network requests, often called a "request waterfall."

1.  The browser requests the initial HTML document.
2.  The document contains a `<script>` tag for the main client entry point (e.g., `/src/client.tsx`). The browser fetches this script.
3.  The client entry point script executes. It contains logic to bootstrap the React application, which may include fetching React and other vendor dependencies.
4.  As React renders on the client, it encounters references to "use client" components (islands) that were streamed from the server. The browser then initiates fetches for the JavaScript modules of these components.

This sequential process introduces latency. Each step must wait for the previous one to complete, delaying the moment when the page becomes fully interactive. The more "use client" components a page has, the more pronounced this waterfall effect becomes.

Our framework architecture, which relies on dynamically discovering client components during the RSC render on the server, gives us a unique opportunity to solve this problem. Since the server knows exactly which client components will be needed for a given page *before* it sends the final HTML, it can provide hints to the browser to fetch these resources much earlier.

### The Challenge: Getting Hints to the Browser

The challenge is to communicate this list of required scripts to the browser so it can start downloading them in parallel with other resources, effectively flattening the request waterfall. We need a mechanism that:

1.  Uses a unified script discovery process, as detailed in [Unified Script Discovery](./unifiedScriptDiscovery.md).
2.  Injects the correct resource hints into the HTML `<head>`.
3.  Relies on [React's ability to automatically hoist `<link>` tags](https://react.dev/reference/react-dom/components/link#special-rendering-behavior) to place the hints correctly.
4.  Does this only in production, as it is unnecessary and could interfere with Vite's optimized development workflow.

## The Solution: A `<Preloads>` Component

The solution is to introduce a server-side React component, `<Preloads>`, whose sole responsibility is to render `<link rel="modulepreload">` tags for every client-side script that will be loaded on the page.

This component is rendered within the part of the application that wraps the RSC stream. It only runs its logic in a production environment. In development, it renders nothing, delegating all module loading to Vite's client-side runtime.

```tsx
const Preloads = ({ requestInfo }) => {
  // In development, getManifest returns an empty manifest.
  const manifest = use(getManifest(requestInfo));
  const allScripts = new Set<string>();

  for (const scriptId of requestInfo.rw.scriptsToBeLoaded) {
    const script = findScriptForModule(scriptId, manifest); // Simplified
    if (script) {
      allScripts.add(script.file);
    }
  }

  return (
    <>
      {/*
        In production, we render <link rel="modulepreload"> tags for all discovered scripts.
        In development, `allScripts` will be empty, and no tags are rendered here.
        Vite will handle module loading on the client side.
      */}
      {Array.from(allScripts).map((href) => (
        <link key={href} rel="modulepreload" href={href} />
      ))}
    </>
  );
};
```
This approach leverages our existing architecture and modern browser capabilities to improve performance without adding significant complexity.
