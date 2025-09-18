# Unified Request Handling

This document outlines the ordered, short-circuiting loop for processing all incoming requests, ensuring that global middleware, React Server Component (RSC) actions, and page routes are handled in the correct sequence.

## The Request Processing Loop

All incoming requests are processed through a single, unified loop that works through the application's flattened list of routes. This design ensures that processing stops as soon as a response is generated, preventing unrelated middleware from interfering with the request. The loop proceeds as follows:

1.  **Sequential Route Evaluation:** The router iterates through the list of routes (which can be middleware functions or page route definitions) in the exact order they are defined.

2.  **Middleware Execution and Short-Circuiting:** When a middleware function is encountered, it is executed immediately. If the middleware returns a `Response` object (e.g., for a redirect), the entire processing loop is terminated, and the response is sent to the client. This is the core short-circuiting behavior.

3.  **RSC Action Handling:** The *first time* a page route definition is encountered in the list, the router immediately checks for and handles any pending RSC action. This timing ensures that all global middleware (i.e., any middleware defined before the first page route) has successfully run before the action handler is invoked.

4.  **Page Route Matching & Rendering:** After the action check, the router attempts to match the page route's path against the request URL.
    *   If it does not match, the loop continues to the next item.
    *   If it matches, its handler (and any route-specific middleware) is executed to generate a response. The loop then terminates.

This single-pass, short-circuiting model is more resilient than a fixed multi-stage pipeline, as it guarantees that only the middleware relevant to a specific request is ever executed.

## Technical Challenges in Request Handling

The framework's design directly addresses several complex challenges inherent in a server-rendering framework.

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

To achieve this, RSC action handling is integrated directly into the request processing loop. It executes after all *global* middleware has run but before the page route itself is processed, ensuring that action handlers have access to a fully-prepared request context.

</aside>
