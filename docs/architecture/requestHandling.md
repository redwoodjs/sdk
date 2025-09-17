# Unified Request Handling Pipeline

This document outlines the ordered, multi-stage pipeline for processing all incoming requests, ensuring that both page requests and React Server Component (RSC) actions are handled consistently.

## The Request Pipeline

All incoming requests are processed through a deterministic, three-stage pipeline inside the router. This design ensures that cross-cutting concerns are handled uniformly before any request-specific logic is executed. The pipeline proceeds as follows:

1.  **Global Middleware Execution:** The router first identifies and executes all global middleware functions in the order they are defined. Middleware can modify the request's context (e.g., by loading a user session) or terminate the request early by returning a `Response` object (e.g., redirecting an unauthenticated user). If any middleware returns a response, the subsequent stages are skipped.

2.  **RSC Action Handling:** After all global middleware has successfully completed, the router inspects the request to determine if it is an RSC action. If it is, the router invokes the appropriate action handler.

3.  **Page Route Matching & Rendering:** Finally, if the request was not terminated by middleware, the router attempts to match the URL against the application's defined page routes. If a matching route is found, its handler (typically a page component) is executed and rendered. For an RSC action request, this stage still runs to re-render the page and provide the client with the updated UI.

## Technical Challenges in Request Handling

The pipeline's design directly addresses several complex challenges inherent in a server-rendering framework.

### Challenge: Aborting a Streamed Render to Return a Response

A significant challenge is handling cases where a route handler, which normally renders a React component, must instead abort the render and return a standard `Response` object (e.g., for a redirect or "not found" error). Because component rendering is an asynchronous, streamed process, a simple `return` statement is not possible from within the React tree.

The framework solves this using a combination of a deferred promise and controlled error throwing:

1.  **Promise Creation:** Before rendering a page component, a deferred promise (`pageRouteResolved`) is created and stored on the request context. This promise acts as a signal to synchronize the outer request handler with the inner rendering process.
2.  **Component Wrapping:** The route's page component is wrapped in a higher-order component. If the inner component's logic attempts to return a `Response`, this wrapper intercepts it.
3.  **Throwing and Signaling:** The wrapper then `throws` the `Response` object. This action immediately aborts React's rendering process.
4.  **Top-Level Catch:** The thrown `Response` propagates up and is caught by a top-level error handler in the main fetch dispatcher, which then returns the `Response` directly to the client.

This mechanism provides a robust way to break out of the asynchronous rendering flow and allows any component in the tree to trigger a standard HTTP response.

<aside>

**A Note on RSC Action Handling**
A core design principle is that all request types, including page loads and RSC actions, must be subject to the same middleware. This guarantees that security policies and context population (e.g., loading a user session) are applied consistently.

To achieve this, RSC action handling is a dedicated stage in the pipeline that executes *after* all global middleware has run. This ensures that action handlers have access to a fully-prepared request context.

</aside>
