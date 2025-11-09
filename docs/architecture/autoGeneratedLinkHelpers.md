# TypeScript-Only Link Helpers

## Challenge

Route definitions live inside `defineApp([...])`. Developers want type-safe helpers like `link("/users/:id", { id: "123" })` without writing the path array twice. Any solution must work during development, in server runtimes, and in the browser bundle. We cannot rely on build-time code generation or runtime manifests.

## Proposed Design

### Route Typing Source

Each `defineApp` call now returns an object that carries the original route array on a private `__rwRoutes` field. TypeScript utility types walk that structure, inspecting nested `render`, `layout`, and `prefix` calls to assemble the union of normalized path strings.

### Link Factory

Expose `linkFor<App>()` and `createLinks<App>()`:

- `linkFor<App>()` returns the typed helper using a type-only reference to the app definition.
- `createLinks<App>()` is an alias for symmetry with the legacy API and remains available for users who prefer the naming.
- `defineLinks(routes)` stays as the manual escape hatch for tests that do not reference the app type.

Both helpers share a compile-time type that maps each route path to its expected params by parsing segments with template-literal types.

### Runtime Behaviour

The runtime interpolation mirrors the previous `defineLinks` implementation but derives its parameter validation directly from the provided argument. No manifests are required and the helper encodes path segments and wildcards before returning the final string.

### Client and Server Usage

Shared modules import the helper with a type-only reference to the worker:

```ts
import type App from "../../worker";
import { linkFor } from "rwsdk/router";

export const link = linkFor<App>();
```

Because the helper is created from types, client bundles do not pull in the worker implementation.

## Tasks

- Capture the original route array on the app definition and export `AppRoutePaths<App>` utilities.
- Update the runtime link helper to operate without manifest inputs while still enforcing parameter usage.
- Document the `linkFor` workflow and adjust starter/playground examples to rely on type-only imports.
- Add unit tests for runtime interpolation and TypeScript tests (future) that exercise inference scenarios.

