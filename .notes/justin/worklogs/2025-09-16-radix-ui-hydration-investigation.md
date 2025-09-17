# Work Log: 2025-09-16 - Radix UI Hydration Investigation

## 1. Initial State & Problem Definition

A hydration issue has been discovered that appears to be specific to Radix UI components when used with our RedwoodSDK framework. The issue manifests during the client-side hydration process, where React fails to properly reconcile the server-rendered HTML with the client-side component tree.

The core hypothesis is that this issue is related to portal-based components, as these components render content outside the normal DOM tree structure and may cause mismatches between server and client rendering expectations.

### Initial Investigation Goals:
1. Create a comprehensive test case with multiple Radix UI components
2. Reproduce the hydration issue consistently  
3. Identify whether portal-based components are the root cause
4. Develop a targeted solution for portal rendering in SSR

## 2. Initial Implementation: Non-Portal Components

The first phase involved implementing a comprehensive test case with multiple Radix UI components to establish a baseline and attempt to reproduce the hydration issue.

### Application Structure
The test was built on the minimal RedwoodSDK starter template with a comprehensive set of Radix UI component packages. A client component page (`RadixDemo.tsx`) was created with multiple interactive components, accessible via `/radix-demo` routing.

### Components Implemented
The test page included comprehensive examples across multiple categories:

1. **Form Controls:** Checkbox, Switch, Toggle, Labels with state management
2. **Progress & Sliders:** Progress bars with dynamic updates, Range sliders with real-time values
3. **Selection Components:** Radio groups, Select dropdowns with full keyboard navigation
4. **Layout Components:** Tabs with multiple content panels, Accordion with collapsible sections, visual Separators
5. **Interactive Components:** Collapsible content areas, Modal Dialog with focus management, Alert Dialog for confirmations, Toast notifications
6. **Additional Components:** Avatar with image fallback, Tooltip with hover interactions, Hover Card with rich content

All components included proper ARIA attributes and comprehensive state management to test hydration behavior.

## 3. Initial Test Results: No Hydration Issues Detected

After implementing and testing the comprehensive component suite, **no hydration issues were observed**. All components rendered correctly, maintained their state during hydration, and functioned as expected in both development and production builds.

This finding suggests that the hydration issue is not present in the majority of Radix UI components, but may be specific to a particular subset of components or usage patterns.

## 4. Hypothesis Refinement: Portal-Based Components

Given that the standard components showed no issues, the investigation focus has shifted to **portal-based components**. These components render content outside the normal DOM tree structure and are more likely to cause server/client rendering mismatches.

### Portal-Based Components in Radix UI
The following Radix UI components use portals and will be the focus of the next investigation phase:
- Dialog and AlertDialog (modal overlays)
- DropdownMenu (contextual menus)
- HoverCard (floating content)
- Popover (positioned content)
- Select (dropdown overlays)  
- Toast (notification overlays)
- Tooltip (hover overlays)

### Why Portals May Cause Issues
Portal-based components present unique challenges for SSR hydration:
1. **DOM Structure Mismatch:** Server renders portal content inline, client renders to portal root
2. **Timing Issues:** Portal mounting may occur after initial hydration
3. **Event Handler Attachment:** Event handlers may attach to different DOM locations
4. **Focus Management:** Focus restoration may fail if DOM structure differs

## 5. Portal Component Analysis and Implementation

Analysis of the Radix UI source code revealed the portal implementation pattern and identified the components that use portals.

### Portal Implementation Pattern
The Radix UI portal primitive (`@radix-ui/react-portal`) uses a specific SSR hydration pattern:
```typescript
const [mounted, setMounted] = React.useState(false);
useLayoutEffect(() => setMounted(true), []);
const container = containerProp || (mounted && globalThis?.document?.body);
return container ? ReactDOM.createPortal(<Primitive.div {...portalProps} ref={forwardedRef} />, container) : null;
```

This pattern ensures portals only render on the client after mounting, which is a common approach to handle server/client rendering differences but may cause hydration mismatches.

### Confirmed Portal-Based Components
Analysis of the Radix UI repository identified seven components that import and use the Portal primitive:
1. **Dialog** (`@radix-ui/react-dialog`) - Modal overlays with focus management
2. **Tooltip** (`@radix-ui/react-tooltip`) - Hover-triggered floating content
3. **Popover** (`@radix-ui/react-popover`) - Click-triggered floating content
4. **HoverCard** (`@radix-ui/react-hover-card`) - Rich hover content
5. **DropdownMenu** (`@radix-ui/react-menu`) - Contextual menus
6. **Select** (`@radix-ui/react-select`) - Dropdown selections
7. **Toast** (`@radix-ui/react-toast`) - Notification overlays

### Focused Test Implementation
A dedicated portal test page (`PortalDemo.tsx`) was created at `/portal-demo` with comprehensive examples of all confirmed portal-based components. Each component includes detailed styling and interaction patterns to test various hydration scenarios including:
- Portal mounting timing
- DOM structure reconciliation
- Event handler attachment
- Focus management
- Positioning and animation behavior

## 6. Next Steps: Hydration Testing

The portal-focused test implementation is now complete. The next phase involves systematic testing to reproduce the hydration issue.

### Testing Protocol
1. **Install Dependencies:** Run `npm install` to ensure all Radix UI portal components are available
2. **Development Testing:** Start the development server and test `/portal-demo` for any hydration warnings
3. **Production Testing:** Build and test the production version for hydration mismatches
4. **Browser Console Monitoring:** Document any hydration warnings or errors specific to portal components
5. **DOM Structure Analysis:** Compare server-rendered HTML with client-rendered DOM for portal content

### Expected Investigation Areas
The portal testing will focus on the specific hydration challenges identified in the portal implementation pattern:
1. **Conditional Rendering:** The `mounted` state pattern may cause server/client render differences
2. **Portal Container Resolution:** Different container resolution between server and client
3. **Event Handler Timing:** Event handlers attaching before or after portal mounting
4. **Focus Management:** Focus restoration in portal-based modals and overlays
5. **Animation and Positioning:** Popper-based positioning behavior during hydration

### Framework Context
- React 19.2.0 canary build with concurrent features and improved hydration
- RedwoodSDK with SSR and client hydration using React Server Components
- Vite build tool with custom plugin architecture for directive scanning
- Cloudflare Workers runtime environment with potential DOM API limitations

## 7. Hydration Error Reproduced with Portal Components

Testing the `/portal-demo` page successfully reproduced the hydration error. The browser console shows a mismatch for `aria-controls` and `id` attributes on multiple portal-based components.

### Hydration Mismatch Log
```
A tree hydrated but some attributes of the server rendered HTML didn't match the client properties. [...]

<DialogTrigger>
  <button
    aria-expanded={false}
    aria-controls="radix-_R_8n_"
    data-state="closed"
    ...
  >
    Open Portal Dialog
  </button>
</DialogTrigger>

<PopoverTrigger>
  <button
    aria-expanded={false}
    aria-controls="radix-_R_9n_"
    data-state="closed"
    ...
  >
    Open Portal Popover
  </button>
</PopoverTrigger>

<SelectTrigger>
  <button
    role="combobox"
    aria-controls="radix-_R_a7_"
    aria-expanded={false}
    ...
  >
  </button>
</SelectTrigger>

<DropdownMenuTrigger>
  <button
    id="radix-_R_b7_"
    aria-haspopup="menu"
    aria-expanded={false}
    ...
  >
    Open Portal Menu
  </button>
</DropdownMenuTrigger>
```

The error clearly indicates that the IDs generated by Radix UI's internal `useId` hook are different between the server-rendered HTML and the client-side hydration pass. The server generates IDs like `radix-_R_25v6_`, while the client generates `radix-_R_8n_`.

## 8. Analysis and External Context

This `useId` mismatch is a known, complex issue in the React ecosystem, particularly within SSR and RSC frameworks. The root cause is that the server-side render of a client component and the client-side render can occur in slightly different contexts, leading to divergent ID generation sequences.

### Key Findings from Community Discussions:

1.  **Framework-Level Issue:** The problem is not unique to this framework. A similar issue was reported in Next.js ([vercel/next.js#78691](https://github.com/vercel/next.js/issues/78691)), where `useId` produced different formats on the server (`:S1:`) versus the client (`«R2fl7»`). This points to frameworks potentially using different React instances or configurations for the server and client environments, which is consistent with our two-phase rendering architecture.

2.  **Historical Radix UI Problem:** Radix UI has contended with this since 2020 ([radix-ui/primitives#331](https://github.com/radix-ui/primitives/issues/331), [#811](https://github.com/radix-ui/primitives/issues/811)). Their original custom ID provider was non-deterministic, especially in `StrictMode`. The long-term solution was to adopt the official `React.useId` hook, which was designed to solve this exact problem. The re-emergence of this bug suggests an edge case created by the specifics of our RSC SSR implementation.

3.  **Community Workaround:** The most common workaround suggested in community channels is to provide explicit, stable `id` props to the Radix components ([Discord Thread 1](https://discord.com/channels/679514959968993311/1367567795893702708/1369746978665402534)). However, this is not always possible, as some components do not expose the necessary props to override the internally generated IDs.

4.  **The "Two-Phase Render" as a Cause:** Our architecture document, `rsc-ssr-process.md`, details a process where client components are first prepared on the server (as part of an RSC payload) and *then* rendered to HTML in a separate SSR pass. This two-step process on the server, followed by a third render on the client for hydration, creates multiple environments where `useId`'s internal counter could be initialized or incremented differently, leading to the mismatch.

### Historical Context and Community Findings

This `useId` hydration mismatch is a well-documented and recurring issue within the broader React ecosystem, particularly for frameworks that implement complex SSR or RSC rendering strategies. The provided history confirms this is not a new problem.

-   **Discord Discussions (2025):** Community members in the framework's Discord have repeatedly encountered this issue, especially with UI libraries like Radix UI.
    -   Key observations include the problem only appearing in `'use client'` components and being reproducible with a minimal `useId()` test case.
    -   The primary workaround has been to manually provide stable `id` props to components, though this is not always possible as some Radix components don't expose the necessary props.
    -   Reference: [Discord Thread 1](https://discord.com/channels/679514959968993311/1381937807408234496/1381971738883129527), [Discord Thread 2](https://discord.com/channels/679514959968993311/1367567795893702708/1369746978665402534)

-   **Next.js Precedent ([vercel/next.js#78691](https://github.com/vercel/next.js/issues/78691)):** The Next.js framework experienced a similar issue where `useId` generated different ID formats between the server and client. This reinforces the hypothesis that framework-level rendering architecture plays a significant role in how React's `useId` hook behaves.

-   **Radix UI's History with SSR IDs:** Radix UI has a long history of tackling this problem.
    -   Initial issues ([#331](https://github.com/radix-ui/primitives/issues/331), [#811](https://github.com/radix-ui/primitives/issues/811)) with their custom `IdProvider` in SSR and React's `StrictMode` led them to abandon it.
    -   The definitive solution was to adopt the official `React.useId` hook, which was created by the React team to solve this exact problem ([#1006](https://github.com/radix-ui/primitives/pull/1006)).
    -   The fact that the issue has reappeared for users of our framework (and previously for Next.js users) strongly suggests that our rendering pipeline is creating an edge case that interferes with React's built-in solution.

This historical context validates that the issue is not with Radix UI itself, but with the interaction between React's `useId` SSR mechanism and our framework's specific rendering architecture.

### Conclusion
The hydration error is a direct result of `React.useId` producing inconsistent values between the server-side HTML render and the client-side hydration. This is likely caused by the framework's two-phase SSR process for client components creating a different rendering context than the one on the client. The next step is to isolate and confirm this behavior.

## 9. `useId` Test Results and Analysis

The `useId` mismatch was consistently reproducible across multiple test runs. The server-rendered HTML contained IDs like `_R_76_`, while the client-side hydration generated `_R_0_`. This strongly suggests that the `useId` counter was not being correctly synchronized between the server and client.

### The `useId` Hook's Internal State
The `useId` hook in React maintains an internal counter (`_R_`) that is incremented with each call. This counter is typically initialized to 0 on the client.

```typescript
const [id] = React.useId();
```

### The `useId` Hook's SSR Process
When React processes a component for SSR, it serializes the current state of the `useId` counter. This state is then passed to the client-side hydration process.

```typescript
const [id] = React.useId();
```

### The `useId` Hook's Hydration Process
When React hydrates a component, it uses the `useId` counter that was serialized by the server.

```typescript
const [id] = React.useId();
```

### The `useId` Hook's Client-Side Initialization
When React initializes a new instance of the `useId` hook on the client, it starts the counter from 0.

```typescript
const [id] = React.useId();
```

### The `useId` Hook's Hydration Mismatch
The `useId` mismatch observed in our tests (`_R_76_` vs. `_R_0_`) indicates that the `useId` counter was not being correctly synchronized between the server and client. This is a critical issue for hydration, as `useId` is used to generate unique IDs for ARIA attributes, event handlers, and other framework-level elements.

## 10. Corrected Root Cause Analysis: `useId` Counter Desynchronization

The initial hypothesis that the `useId` mismatch was caused by different React runtimes (`react-server` vs. standard) was incorrect. As clarified, the use of different runtimes in the `worker` (RSC) and `ssr` (client component SSR) environments is intentional and correct by design. The `ssr` environment and the `client` environment both use the same classic React runtime, so the hydration mismatch must have a different cause.

### The New Hypothesis: Server Counter State is Not Transferred to Client

The root cause is a desynchronization of the `useId` internal counter between the server render and the client hydration.

1.  **Server Render Context:** During the server-side render (in the `ssr` environment), React processes the entire application tree as described by the RSC payload. This includes not just the user-facing components but also framework-level wrappers and providers. These internal components may also use `useId`, incrementing React's internal ID counter. By the time a specific client component like `UseIdDemo` is rendered, the counter has already reached a high value (e.g., 76).

2.  **Client Hydration Context:** When the client-side JavaScript loads, it begins the hydration process. It has no knowledge of the server's initial rendering of framework components. It initializes a fresh instance of React with a `useId` counter starting at 0.

3.  **The Mismatch:** When React tries to hydrate the `UseIdDemo` component, it generates an ID of `_R_0_`. This does not match the `_R_76_` in the server-rendered HTML, causing the hydration to fail.

The fundamental problem is that the state of the `useId` counter from the server is not being successfully passed down and used to "seed" the counter on the client, which is a process that React's SSR tooling should handle automatically. Our framework's custom SSR bridge and rendering pipeline is likely interfering with this built-in synchronization mechanism.

### Next Step: Investigate React's `useId` SSR Synchronization Mechanism

The immediate next step is to investigate how `React.useId` is *supposed* to work in a standard SSR environment. Understanding the mechanism React uses to serialize and resume the ID counter across the server-client boundary will allow us to identify where our custom rendering pipeline might be breaking this process. The investigation will focus on the data passed between `react-dom/server` and `react-dom/client` and how our `ssrBridge` might be failing to preserve it.

## 11. Definitive Root Cause: Broken `useId` State Transfer

An analysis of the React source code (`packages/react-reconciler/src/ReactFiberHooks.js`) has revealed the precise mechanism behind the `useId` hydration failure. The issue is not a bug in React, but a failure in our framework's custom rendering pipeline to correctly transfer the necessary state from the server to the client.

### React's `useId` Hydration Mechanism

The implementation of the `mountId` function, which is called by `useId` during the initial render, contains the following critical logic:

```javascript
// in React's source
function mountId(): string {
  // ...
  if (getIsHydrating()) {
    const treeId = getTreeId();
    id = '_' + identifierPrefix + 'R_' + treeId;
    // ...
  } else {
    // ... other ID generation logic for server or client-only render
  }
}
```

This reveals that React's `useId` hook relies on a server-generated "tree ID" to ensure consistency during client-side hydration. During the server render, React generates a sequence of these tree IDs. During hydration on the client, React expects to find this same sequence to regenerate the exact same IDs.

### How the Framework Breaks the Mechanism

The `useId` counter desynchronization is a symptom of this state transfer failing. Our framework's two-phase render via the SSR Bridge is interrupting this data flow.

1.  **Server Render:** The `ssr` environment correctly generates the `treeId` sequence as it renders client components to HTML.
2.  **State Transfer Failure:** Our custom pipeline, which bridges the `ssr` and `worker` environments and constructs the final HTML document, is not capturing this `treeId` state and embedding it in the page for the client to use.
3.  **Client Hydration:** The client-side React runtime does not find the expected `treeId` sequence. As a result, its `getTreeId()` function starts from a different (likely default) state, generating a completely different sequence of IDs (`_R_0_`, etc.) and causing the hydration to fail.

## 12. The Solution Path

The solution is to repair this broken state transfer. This will involve modifying the framework's rendering pipeline to correctly handle the state generated by React's SSR renderer.

### Next Steps

1.  **Identify the State Source:** Investigate the APIs of `react-dom/server` (e.g., `renderToPipeableStream`) to determine how the `treeId` sequence and any other necessary hydration state are exposed by the server renderer.
2.  **Audit the SSR Bridge:** Analyze the `ssrBridge` and the `transformRscToHtmlStream` function to identify where this state is being lost. The data needs to be captured from the output of the `ssr` environment's render.
3.  **Implement State Injection:** Modify the final HTML rendering logic to correctly serialize and embed this state into the HTML document, likely within a `<script>` tag, so that the client-side `react-dom/client` can consume it during hydration.

## 13. Definitive Mechanism: The `resumableState` Object

The successful hydration of `React.useId` is entirely dependent on a server-generated object called `resumableState`. A deep dive into the React DOM server source code (`packages/react-dom/src/server/ReactDOMFizzServerNode.js`) has revealed this is the exact mechanism React uses to synchronize `useId` across the server and client.

### How it Works

1.  **Creation on the Server:** When `renderToPipeableStream` (or a similar Fizz server API) is called, it internally creates a `resumableState` object. This object is initialized with an `identifierPrefix` and serves as the container for all state needed to "resume" or "hydrate" the application on the client, including the initial state of the `useId` counter.

2.  **Serialization and Injection:** The React server renderer then serializes this `resumableState` and typically embeds it within the HTML stream, often as part of the bootstrap script content.

3.  **Consumption by the Client:** The client-side React runtime finds this serialized state during its initialization and uses it to configure its own internal state, including seeding the `useId` counter to the exact state it was in at the end of the server render.

### How the Framework Breaks It

The current implementation of our runtime rendering functions is the point of failure. The `ssrBridge` correctly provides the `renderRscThenableToHtmlStream` function from the `ssr` environment to the `worker` environment. However, the data contract between these functions is incomplete.

1.  **SSR Render:** Inside the `ssr` environment, the `renderRscThenableToHtmlStream` function calls React's `renderToPipeableStream`. This call correctly generates both the HTML stream and the critical `resumableState` object.

2.  **State Transfer Failure:** The `renderRscThenableToHtmlStream` function currently only returns the HTML stream. It effectively discards the `resumableState` object, which is never passed back across the bridge to the calling `worker` environment.

3.  **Final HTML Assembly:** The `transformRscToHtmlStream` function in the `worker` environment receives only the HTML stream. It assembles the final response without the necessary `resumableState`, meaning the client never receives the data needed to synchronize its `useId` counter.

## 14. The Solution: Passing `resumableState` Through the Rendering Functions

The solution is to modify the signatures of our runtime rendering functions to correctly handle and forward the `resumableState`. This is a change to the runtime code, not the Vite plugin build configuration.

### Implementation Plan

1.  **Modify `renderRscThenableToHtmlStream` (in the `ssr` environment):** This function's signature must be changed. Instead of just returning a `ReadableStream`, it must return an object or tuple containing both the stream and the `resumableState` object generated by the React server renderer.

2.  **Update `transformRscToHtmlStream` (in the `worker` environment):** This function, which calls the bridge function, must be updated to handle the new return signature. It will receive both the stream and the `resumableState` and must pass them up the call stack.

3.  **Inject State in `renderToStream` (in the `worker` environment):** This higher-level function will ultimately receive the `resumableState`. It will then be responsible for serializing this state and injecting it into the final HTML response stream that is sent to the browser.

This change will repair the broken state transfer by ensuring the `resumableState` is passed from the `ssr` environment where it is created, back to the `worker` environment where the final response is assembled, and finally down to the client.

## 15. Final Rationale for the `bootstrapScriptContent` Solution

After a deep investigation into React's source code, the precise mechanism and rationale for the `bootstrapScriptContent` fix has been clarified. The solution is not a workaround, but the correct usage of React's server rendering API to signal the intent to hydrate.

The key insight is that the `bootstrapScriptContent` option provides a **template** for the very `<script>` tag that React generates to embed the `resumableState` JSON into the HTML stream. The option's purpose is to tell React what other JavaScript code, if any, should be placed inside that same script tag along with the hydration state.

-   When `bootstrapScriptContent: ' '` is provided, we are giving React the minimal valid template. We are instructing it to generate the state-bearing script tag, but telling it that we have no *additional* code to place inside that specific tag.

This correctly triggers the serialization of `resumableState`—which is required to fix the `useId` hydration mismatch—without producing any redundant or unwanted client-side code. It is the most direct and precise way to enable hydration.

## 16. Final Solution: The Two-Stream Stitching Render

The fix using `bootstrapScriptContent` proved to be a red herring. While it was based on a correct understanding of React's `resumableState`, it failed because the underlying rendering architecture was not aligned with React's expectations for its streaming renderer.

### 16.1. The Core Misalignment

The investigation revealed a fundamental conflict between the framework's API philosophy and the design of React's streaming SSR.

1.  **Framework Philosophy:** The user must have full and explicit control over the entire HTML document via a `Document.tsx` component. This is a core design principle to avoid "magic" and ensure transparency.
2.  **React's Expectation:** For `useId` hydration to work, React's `renderToReadableStream` function *must* be the one to render the outer document shell (`<html>`, `<head>`, `<body>`). When it does so, it generates and injects a "preamble" into the `<head>`, which contains the critical `useId` seed (`resumableState`) needed for the client to synchronize its ID counter.

When we passed our user-defined `Document` into React's renderer, we prevented React from ever generating this preamble, leading directly to the hydration mismatch.

### 16.2. The Two-Stream Stitching Solution

To resolve this without compromising the framework's philosophy or sacrificing performance, a fully streaming two-stream stitching strategy was implemented in `renderToStream.tsx`. Two separate render processes are executed concurrently, and their resulting streams are stitched together on the fly to create the final HTML output.

**Stream 1: The React Shell.** First, React's renderer is called with *only* the application's core content. This produces a stream (`reactShellStream`) containing a minimal `<html>` shell where the `<head>` includes the critical preamble with `resumableState`.

**Stream 2: The User Document.** Concurrently, the user's `Document` component is rendered into its own stream via a new SSR-bridged function, `renderDocumentToStream`.

A final `stitcher` transform stream is used to combine them. It processes the user's `Document` stream, injects the preamble extracted from the React Shell stream into the `<head>`, and pipes the body of the React Shell stream into the `<body>`.

The final output is a single, stitched stream that respects the user's `Document` structure, contains the state for hydration, and maintains the performance benefits of streaming from end to end.

### 16.3. Performance Considerations of the Streaming Solution

This two-stream stitching approach successfully solves the hydration problem while preserving the framework's API philosophy and the core benefits of streaming. However, it is important to acknowledge a minor performance trade-off inherent in the design: head-of-line blocking.

**What is Head-of-Line Blocking?**
Head-of-line blocking, in this context, means that the final HTML stream sent to the browser cannot begin until a small, initial part of the internal React Shell stream has been processed. The system must wait until it has received and parsed the entire `<head>` from the React Shell to extract the crucial preamble. Only after this is complete can the final stitched stream begin to be assembled and sent to the browser.

**Why is this Acceptable?**
This trade-off is considered acceptable for two main reasons:

1.  **Minimal Buffering:** The amount of data that needs to be buffered is very small—only the content of the `<head>` tag from React's minimal shell. This results in a negligible delay to the Time To First Byte (TTFB) when compared to buffering the entire page, which was the flaw in the previous blocking implementation. The main application content within the `<body>` remains fully streamed from end to end.
2.  **Architectural Integrity:** It is a small and necessary price to pay to preserve the simple and powerful user-controlled `Document` API, which is a core design principle. It allows the framework to achieve correctness without compromising on its developer experience goals or sacrificing the most significant performance benefits of streaming.
