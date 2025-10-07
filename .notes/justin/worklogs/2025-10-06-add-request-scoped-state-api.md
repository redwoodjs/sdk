# Add Request-Scoped State API

**Date**: 2025-01-06

## Problem Definition & Goal

Module-level singletons (like `PrismaClient`) cause worker hangs and cross-request promise resolution warnings in Cloudflare Workers due to shared state across concurrent requests. The error manifests as:

```
A promise was resolved or rejected from a different request context than the one it was created in.
```

This happens because Cloudflare Workers restrict execution context to the current request, making it problematic to share stateful objects across requests.

The goal was to implement a generic request-scoped state management API that would allow developers to use singleton patterns safely in Cloudflare Workers while maintaining the same developer experience.

## Investigation: Understanding the Root Cause

The issue stems from Cloudflare Workers' execution model, where each request runs in its own isolated context. When a module-level singleton like `PrismaClient` is created, it gets reused across multiple concurrent requests, leading to state corruption and promise resolution errors.

This is particularly problematic in scenarios with:
1. Multiple concurrent requests
2. Realtime features with rapid interactions
3. Database operations that maintain internal state
4. Any stateful object that needs to be isolated per request

The warning message "A promise was resolved or rejected from a different request context" is the critical clue that confirms the problem is state management, not a silent hang.

## Attempt 1: Extending RequestInfo with User Context

The first approach was to extend the existing `RequestInfo` interface to include a generic user context property for storing request-scoped state.

**Implementation:**
- Added `__userContext?: Record<string, any>` to the `RequestInfo` interface
- Added `__userContext` to the `REQUEST_INFO_KEYS` array in `worker.ts`
- Modified `worker.tsx` to initialize `__userContext: {}` for each request

**Result:** This provided the foundation for request-scoped state storage, but we still needed a clean API for developers to use it.

## Attempt 2: Creating a Getter/Setter API

The next approach was to create a `defineRequestState` function that would return a getter and setter pair for accessing request-scoped state.

**Implementation:**
- Created `defineRequestState` function that returns `[getter, setter]` tuple
- Used `crypto.randomUUID()` to generate unique keys for each state variable
- Implemented getter that reads from `requestInfo.__userContext`
- Implemented setter that writes to `requestInfo.__userContext`

**Result:** This approach failed because returning a getter function instead of a proxy object caused `db.findUnique()` to fail, as `db` wasn't actually a `PrismaClient` instance.

## Attempt 3: Implementing Proxy-Based Delegation

The key insight was that we needed a proxy object that would behave exactly like the target object while being request-scoped. This would allow existing usage patterns to work transparently.

**Implementation:**
- Created a `Proxy` object that delegates all property access to the request-scoped instance
- Implemented `get` trap that retrieves the instance from `requestInfo.__userContext`
- Implemented `set` trap that writes to the request-scoped instance
- Added method binding using `.bind(instance)` to preserve context

**Result:** This approach was successful. The proxy correctly delegates all property access and method calls to the request-scoped instance, making it transparent to the user.

## Attempt 4: Handling Frozen Object Error

During testing, we encountered an error: "Cannot set property __userContext of #<Object> which has only a getter". This was because `requestInfo` was frozen and read-only.

**The Problem:** `requestInfo` is an immutable object, and `__userContext` cannot be directly assigned to it.

**The Solution:** We realized that `requestInfo` is frozen, but we can mutate objects on it. The issue was that we needed to ensure `__userContext` was properly initialized and accessible.

**Result:** By initializing `__userContext: {}` in `worker.tsx` and ensuring it's part of the request-scoped store, we resolved the frozen object error.

## Final Solution: Proxy-Based Request-Scoped State

The final implementation provides a complete request-scoped state management system:

1. **Extended RequestInfo**: Added `__userContext: Record<string, any>` for generic request state
2. **Initialized User Context**: Modified `worker.tsx` to initialize `__userContext: {}` per request
3. **Created `defineRequestState` API**: Returns a proxy object and setter function
4. **Proxy Implementation**: Delegates all property access to request-scoped instances

**Key Technical Details:**
- **Proxy Object**: Behaves exactly like the target object while being request-scoped
- **Method Binding**: Correctly binds methods to their original context using `.bind(instance)`
- **Unique Keys**: Uses `crypto.randomUUID()` for collision-resistant keys
- **Error Handling**: Clear error messages when state is accessed before initialization

**API Usage:**
```typescript
// User's code
export const [db, setDb] = defineRequestState<PrismaClient>();

export const setupDb = async (env: Env) => {
  const client = new PrismaClient({
    adapter: new PrismaD1(env.DB),
  });
  await client.$queryRaw`SELECT 1`;
  setDb(client); // Store in request context
};

// Usage remains the same
await db.findUnique({ where: { id: 1 } });
```

## Status

✅ **Implemented and tested** - Fixes worker hanging issues caused by shared PrismaClient instances.

## Benefits

- **Transparent**: No changes required to existing usage patterns
- **Isolated**: Each request gets its own instance, preventing state corruption
- **Reusable**: Generic API can be used for any request-scoped state
- **Performance**: Leverages existing AsyncLocalStorage infrastructure

## Current Implementation Status

**Files Modified:**
- `sdk/src/runtime/lib/requestState.ts` - New file with `defineRequestState` API
- `sdk/src/runtime/requestInfo/types.ts` - Added `__userContext` to `RequestInfo` interface
- `sdk/src/runtime/requestInfo/worker.ts` - Added `__userContext` to `REQUEST_INFO_KEYS` and made it mutable
- `sdk/src/runtime/worker.tsx` - Initialize `__userContext: {}` for each request
- `sdk/package.json` - Added export for `./requestState`
- `redwoodsdk-demo/src/db.ts` - Updated to use request-scoped Prisma client

**Key Changes:**
1. Created `defineRequestState<T>()` function that returns `[proxy, setter]` tuple
2. Extended `RequestInfo` interface with `__userContext: Record<string, any>`
3. Made `__userContext` mutable in the request info worker
4. Initialized `__userContext: {}` in each request context
5. Updated demo app to use request-scoped Prisma client pattern
6. Added package export for the new API

**API Implementation:**
- Uses `crypto.randomUUID()` for unique keys to prevent collisions
- Proxy object delegates all property access to request-scoped instance
- Method binding preserves `this` context using `.bind(instance)`
- Clear error messages when state is accessed before initialization

**Demo App Changes:**
```typescript
// Before: Module-level singleton
export const db = new PrismaClient({...});

// After: Request-scoped state
export const [db, setDb] = defineRequestState<PrismaClient>();

export const setupDb = async (env: Env) => {
  const client = new PrismaClient({
    adapter: new PrismaD1(env.DB),
  });
  await client.$queryRaw`SELECT 1`;
  setDb(client); // Store in request context
};
```

**Testing Status:**
- ✅ Fixes worker hanging issues
- ✅ Eliminates "cross-request promise resolution" warnings
- ✅ Works with realtime features and multiple concurrent requests
- ✅ Transparent to existing usage patterns

## Testing with Simple Stateful Objects

To verify the request-scoped state API works with different types of stateful objects beyond PrismaClient, I created a playground example with a simple Counter class.

**Implementation:**
- Created `playground/request-scoped-state-examples/` with a complete RedwoodSDK app
- Implemented a `Counter` class with methods: `increment()`, `decrement()`, `getValue()`, `reset()`
- Used `defineRequestState<Counter>()` to create request-scoped counter instances
- Added both server-side and client-side components to demonstrate state isolation

**Key Files Created:**
- `src/counter.ts` - Simple stateful Counter class
- `src/counterState.ts` - Request-scoped state setup using `defineRequestState`
- `src/CounterServer.tsx` - Server-side component demonstrating state isolation
- `src/CounterDemo.tsx` - Client-side interactive component
- `__tests__/e2e.test.mts` - End-to-end tests for state isolation

**Testing Results:**
- ✅ **State Isolation**: Each request gets its own isolated counter instance
- ✅ **Method Binding**: Counter methods work correctly with proper `this` context
- ✅ **Property Access**: Direct property access works transparently
- ✅ **Error Handling**: Clear errors when state is accessed before initialization
- ✅ **Unique Keys**: `crypto.randomUUID()` prevents key collisions between state variables
- ✅ **Proxy Delegation**: Proxy object behaves exactly like the target object

**Simple Test Implementation:**
Created a standalone test (`simple-test.js`) that demonstrates the core concept without SDK dependencies:

```javascript
// Test results showed:
// - State isolation between requests ✅
// - Error handling for uninitialized state ✅  
// - Method binding works correctly ✅
// - Property access works correctly ✅
// - Unique keys prevent collisions ✅
```

**Findings:**
The request-scoped state API successfully isolates state between concurrent requests for any stateful object, not just PrismaClient. The proxy-based approach ensures transparent usage while maintaining proper isolation.

## Next Steps

- [ ] Document the API in user-facing documentation
- [ ] Add examples showing usage with different database clients
- [ ] Consider adding TypeScript utility types for better DX
- ✅ Test with other stateful objects beyond PrismaClient
