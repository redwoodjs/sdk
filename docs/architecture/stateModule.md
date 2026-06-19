# State Module

This document describes `rwsdk/__state`, the framework's centralized state module. It exists to keep framework-level state alive across Vite's development-server reloads, and to give application and framework code a single, explicit place to register shared values.

## The Challenge: State Loss During Re-Optimization

Vite's development server pre-bundles dependencies on demand. When it discovers a new import after startup, it runs a "re-optimization" pass and reloads the affected environment. In RedwoodSDK that environment is the `worker` environment running inside Miniflare.

A reload creates fresh module instances for every module Vite touched. Any state stored at module level—`AsyncLocalStorage` instances, in-memory caches, counters, or request-scoped bags—is destroyed. This is especially problematic for request context, which relies on `AsyncLocalStorage`: a re-optimization in the middle of a request can replace the store module, orphan active contexts, and crash the application.

## The Solution: A Single Virtual State Module

Instead of scattering state across many modules, the framework funnels all durable state through one module, `rwsdk/__state`. A dedicated Vite plugin (`statePlugin`) treats this module specially:

- In development, the plugin resolves `rwsdk/__state` to a virtual module (`virtual:rwsdk:state:...`) for the `worker` environment.
- It marks the module as **external** in the dependency optimizer's `esbuild` pipeline.
- Because the optimizer excludes it from the dependency graph, Vite does not re-instantiate it when it re-optimizes other dependencies.

This makes `rwsdk/__state` the only module that survives a re-optimization reload, giving the rest of the framework a stable place to store critical state.

## API

The module exposes three functions. They are typed in `sdk/types/state.d.ts`.

### `defineRwState<T>(key: string, initializer: () => T): T`

Returns the existing value for `key`, or creates it by calling `initializer` if it does not yet exist. This is the primary way framework code should register state.

```ts
import { defineRwState } from "rwsdk/__state";

const requestInfoStore = defineRwState(
  "requestInfoStore",
  () => new AsyncLocalStorage<Record<string, any>>(),
);
```

Because the module itself is not reloaded, the same object is returned across re-optimizations.

### `getRwState<T>(key: string): T | undefined`

Retrieves a previously defined value, or `undefined` if it has not been registered.

### `setRwState<T>(key: string, value: T): void`

Stores a value directly. Use sparingly; `defineRwState` is preferred because it guarantees initialization order.

## Implementation

The real implementation lives in `sdk/src/runtime/state.ts`. It is a tiny module-global `Record<string, any>` plus the three functions above. Its simplicity is intentional: the less logic it contains, the less likely it is to behave differently across reloads.

The `statePlugin` in `sdk/src/vite/statePlugin.mts` wires the module into Vite:

1. It resolves `rwsdk/__state` to the runtime implementation path in production and preview builds.
2. In development it resolves the specifier to a virtual module for the `worker` environment.
3. It injects an `esbuild` plugin into `worker.optimizeDeps.esbuildOptions.plugins` that intercepts both `rwsdk/__state` and the virtual prefix and returns `{ external: true }`.

Marking the specifier external in the optimizer is the critical step. The optimizer runs `esbuild` over the dependency graph; by returning `external: true` we tell `esbuild` not to bundle the module, not to hash it, and not to include it in the reloadable dependency graph. The worker's module runner then imports it through the normal Vite resolution path, which resolves to the virtual module whose `load` hook simply reads the runtime implementation file.

## Why This Works

Vite's re-optimization invalidates and reloads modules that are part of the optimized dependency graph. By keeping `rwsdk/__state` outside that graph, we ensure that:

- The module object is not discarded when other dependencies are re-bundled.
- Framework code that imports it continues to reference the same module instance.
- State stored in that instance persists across the reload.

This does not prevent re-optimizations; it only prevents them from destroying state that the framework needs to survive.

## Scope and Usage Guidelines

`rwsdk/__state` is intended for framework-level state that must outlive a reload. Good candidates:

- `AsyncLocalStorage` request context stores.
- Small, deterministic caches that are expensive to recreate.

It is not a general-purpose application state store. Application state should still use React state, server-side storage, Durable Objects, or other persistence mechanisms appropriate to the feature.

By centralizing durable state behind a single, well-known specifier, the framework also makes its dependency on reload-surviving state explicit and auditable.
