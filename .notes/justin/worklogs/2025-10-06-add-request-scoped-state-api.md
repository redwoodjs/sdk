# Work Log: 2025-10-06 - Add Request-Scoped State API

## 1. Problem Definition & Goal

Cloudflare Workers require the execution context to be tied to the current request. This poses a problem for stateful, module-level singletons (like `PrismaClient`). When a stateful object is defined at the module level, the same instance is shared across multiple, concurrent requests. This violates the execution context constraint and leads to state corruption and errors.

We ran into this issue while working on a real-time demo. With multiple clients interacting rapidly, the worker handles many concurrent requests. This triggers hangs and the following warning:

```
Warning: A promise was resolved or rejected from a different request context than the one it was created in.
```

This is not an issue for libraries like Kysely when used with `RWSDKDB`, because each database call results in a fresh instantiation of the client, avoiding shared state. However, for any long-lived, stateful object, its state must be scoped to the individual request.

The goal was to implement a generic API that allows developers to define and use module-level state in a way that is transparently scoped to each request under the hood.

## 2. Investigation: Understanding the Root Cause

The root cause is the conflict between the common software pattern of using module-level singletons for things like database clients and the stateless, request-isolated execution model of Cloudflare Workers.

When a singleton `PrismaClient` is used, its internal connection pooling and transaction management state gets shared across different requests. When Request A makes a call, and then Request B makes a call before A is finished, they are both mutating the same shared object. Because the worker runtime isolates the I/O and context for each request, this leads to a race condition where a promise created in Request A's context might be resolved by an action in Request B's context.

The worker runtime detects this and emits the cross-request promise resolution warning. In many cases, it also determines the worker has hung because it cannot safely resolve the state and terminates the request.

The solution required a mechanism to create, store, and retrieve a unique instance of a stateful object for each request, while allowing the developer to interact with it as a simple module-level variable.

## 3. Attempt #1: A Storage Location on RequestInfo

The first step was to establish a place to store request-scoped data. We already have a primitive for request-level context: the `requestInfo` object, which is managed by `AsyncLocalStorage`. This was the logical place to store user-defined state.

**Implementation:**
-   Added `__userContext?: Record<string, any>` to the `RequestInfo` interface.
-   Modified the worker entrypoint to initialize `__userContext: {}` for each request.

**Result:** This provided the necessary storage foundation. We now had a per-request object to hold state.

## 4. Attempt #2: A Getter/Setter API

The next step was to design an API. The initial idea was a `defineRequestState` function that would provide a getter and a setter to interact with a value in the `__userContext`.

**Implementation:**
-   The `defineRequestState` function generated a unique key for a given piece of state.
-   It returned a `[getter, setter]` tuple.
-   The getter would read from `requestInfo.__userContext`.
-   The setter would write to `requestInfo.__userContext`.

**Result:** This failed in practice because it broke the developer experience. Code expecting a `PrismaClient` instance (e.g., `db.findUnique()`) received a getter function instead. The API was not transparent and would require significant refactoring of user code.

## 5. Attempt #3: Transparent Delegation with a Proxy

The failure of the getter/setter API revealed a key requirement: the API must be transparent. The developer should interact with a variable that looks and feels exactly like a real instance of their stateful object, even though its underlying instance is changing with every request. A `Proxy` was the ideal tool for this.

**Implementation:**
-   The `defineRequestState` function was changed to return `[proxy, setter]`.
-   A `Proxy` object was created with a `get` trap.
-   Inside the `get` trap, the correct request-scoped instance is retrieved from `requestInfo.__userContext`.
-   The trap then delegates the property access or method call to that instance, ensuring the `this` context is correct.

**Result:** This was the breakthrough. The proxy object behaved identically to a real `PrismaClient` instance, allowing existing code like `db.findUnique()` to work without modification.

## 6. Attempt #4: Handling Immutability of RequestInfo

During implementation, a new error emerged: "Cannot set property __userContext of #<Object> which has only a getter". `RequestInfo` itself is frozen after creation.

**The Fix:**
The fix was to ensure `__userContext` was initialized as an empty object (`{}`) when the `RequestInfo` object was first created. The reference to this object is frozen, but the object itself is mutable. Our setter function could then freely add properties to this pre-existing `__userContext` object.

**Outcome:**
This solved the immutability error. The combination of initializing the context object early and using a proxy for transparent access provided a complete solution.

## 7. Playground and E2E Tests

To validate the solution, a new playground example `request-scoped-state` was created.

- It initializes a `Counter` instance for each request in a middleware.
- A server component (`CounterServer.tsx`) accesses and manipulates this counter.
- An end-to-end test (`e2e.test.mts`) verifies that the counter's state is correctly managed and isolated on the server for each request.

## PR Description

### Problem

Cloudflare Workers require the execution context to be tied to the current request, which poses a problem for stateful, module-level objects. When a stateful client like `PrismaClient` is instantiated at the module level, its instance is shared across concurrent requests. This violates the execution context constraint, leading to state corruption.

This issue was observed in a real-time demo with multiple clients making rapid, concurrent requests. The worker would hang and produce the following error:

```
Warning: A promise was resolved or rejected from a different request context than the one it was created in.
```

This is not an issue for patterns that create a fresh client on each use (e.g., how `RWSDKDB` uses Kysely), but it prevents the common and convenient pattern of using a module-level database client.

### Solution

This change introduces a request-scoped state management API that allows developers to use stateful, module-level variables safely.

We already have a primitive, `requestInfo`, that uses `AsyncLocalStorage` to provide a request-level context. This change adds a user-facing API, `defineRequestState`, that builds on top of this primitive.

It allows developers to define their own request-scoped state. To provide a transparent developer experience, the API returns a `Proxy` object. This proxy delegates all property access and method calls to the true, request-specific instance under the hood. This means developers can interact with the variable as if it were a normal module-level singleton, with no changes to their application code.

This will be used to safely define the Prisma client at the module level, like so:

```typescript
import { PrismaClient } from '@generated/prisma';
import { PrismaD1 } from '@prisma/adapter-d1';
import { defineRequestState } from 'rwsdk/worker';
export type * from '@generated/prisma';

// Use request-scoped state to prevent cross-request state corruption
export const [db, setDb] = defineRequestState<PrismaClient>();

export const setupDb = async (env: Env) => {
  const client = new PrismaClient({
    adapter: new PrismaD1(env.DB),
  });

  await client.$queryRaw`SELECT 1`;

  // Set the client in the current request context
  setDb(client);
};
```

A playground example, `request-scoped-state`, has been added to demonstrate and test this functionality.
