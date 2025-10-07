# Work Log: 2025-10-06 - Add Request-Scoped State API

## 1. Problem Definition & Goal

Module-level singletons (like `PrismaClient`) cause worker hangs and cross-request promise resolution warnings in Cloudflare Workers due to shared state across concurrent requests. The error manifests as:

```
A promise was resolved or rejected from a different request context than the one it was created in.
```

This happens because Cloudflare Workers restrict execution context to the current request, making it problematic to share stateful objects across requests.

The goal was to implement a generic request-scoped state management API that would allow developers to use singleton patterns safely in Cloudflare Workers while maintaining a transparent developer experience.

## 2. Investigation: Understanding the Root Cause

The issue stems from Cloudflare Workers' execution model, where each request runs in its own isolated context. When a module-level singleton like `PrismaClient` is created, it gets reused across multiple concurrent requests. This leads to an internal state collision, which manifests as promises being resolved in a different context from where they were created.

This is particularly problematic in scenarios with:
1.  Multiple concurrent requests
2.  Realtime features with rapid interactions
3.  Database operations that maintain internal state
4.  Any stateful object that needs to be isolated per request

The warning message "A promise was resolved or rejected from a different request context" is the critical clue that confirms the problem is state management, not a silent hang. The solution required a mechanism to create, store, and retrieve an instance of a stateful object for each unique request.

## 3. Attempt #1: A Storage Location on RequestInfo

The first step was to establish a place to store request-scoped data. The most logical place was the existing `RequestInfo` object, which is already managed by `AsyncLocalStorage` and is unique to each request. The plan was to extend it with a generic property.

**Implementation:**
-   Added `__userContext?: Record<string, any>` to the `RequestInfo` interface.
-   Modified the worker entrypoint to initialize `__userContext: {}` for each request.

**Result:** This provided the necessary storage foundation. We now had a per-request object to hold state. However, this was just the storage; a developer-facing API was still needed to manage the state within it.

## 4. Attempt #2: A Getter/Setter API

The next step was to design an API for developers. The initial idea was a function, `defineRequestState`, that would provide a getter and a setter to interact with a value in the `__userContext`.

**Implementation:**
-   The `defineRequestState` function generated a unique key for a given piece of state.
-   It returned a `[getter, setter]` tuple.
-   The getter would read from `requestInfo.__userContext` using the unique key.
-   The setter would write to `requestInfo.__userContext` using the unique key.

**Result:** This approach failed in practice. While it stored the state correctly, it broke the developer experience. Code expecting a `PrismaClient` instance (e.g., `db.findUnique()`) received a getter function instead. The API was not transparent and would require significant refactoring of user code.

## 5. Attempt #3: Transparent Delegation with a Proxy

The failure of the getter/setter API revealed a key requirement: the API must be transparent. The developer should interact with a variable that looks and feels exactly like a real instance of their stateful object (e.g., `PrismaClient`), even though its underlying instance is changing with every request.

A `Proxy` was the ideal tool for this.

**Implementation:**
-   The `defineRequestState` function was changed to return `[proxy, setter]`.
-   A `Proxy` object was created with a `get` trap.
-   Inside the `get` trap, the correct request-scoped instance is retrieved from `requestInfo.__userContext`.
-   The trap then delegates the property access to that instance.
-   For methods, the trap also binds the method to the instance to ensure the `this` context is correct.

**Result:** This was a major breakthrough. The proxy object behaved identically to a real `PrismaClient` instance, allowing existing code like `db.findUnique()` to work without modification. The solution was now transparent.

## 6. Attempt #4: Handling Immutability of RequestInfo

During implementation of the proxy, a new error emerged: "Cannot set property __userContext of #<Object> which has only a getter".

**Investigation:**
Debugging showed that the `RequestInfo` object itself is frozen after creation and cannot be mutated. Our initial approach of adding the `__userContext` property on the fly was flawed.

However, while the object itself is immutable, the objects it references are not. This was the key insight.

**The Fix:**
The fix was to ensure `__userContext` was initialized as an empty object (`{}`) when the `RequestInfo` object was first created in the worker entrypoint. The reference to this object is frozen, but the object itself is mutable. Our setter function could then freely add properties to this pre-existing `__userContext` object without trying to modify the frozen `RequestInfo`.

**Outcome:**
This solved the immutability error. The combination of initializing the context object early and using a proxy for transparent access provided a complete and robust solution for request-scoped state management.
