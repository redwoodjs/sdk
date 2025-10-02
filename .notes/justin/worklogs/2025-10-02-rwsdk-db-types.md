# Work Log: `rwsdk/db` API and Type Inference Refinement

**Date:** 2025-10-02

## Problem

The initial goal was to create a working end-to-end test for `rwsdk/db` in the `playground/database-do` example. This was blocked by a cascade of complex TypeScript errors originating from the `createDb` function. The errors pointed to a fundamental issue in how the database and durable object types were being handled.

## Investigation and Thought Process

The path to the solution involved several attempts and backtracking as we gained a deeper understanding of the problem.

### Attempt 1: Explicitly Passing All Generic Types

The first key insight was that TypeScript's generic inference has a limitation: you must either specify all type arguments or none. The original `createDb<T>` signature only allowed specifying the database type, which prevented TypeScript from inferring the `DurableObject` type from the arguments.

The initial fix was to change the signature to `createDb<T, DurableObject>` and update the call site to `createDb<AppDatabase, AppDurableObject>(...)`.

-   **Outcome:** This resolved the immediate, cryptic errors but led to a new problem: `Property 'todos' does not exist on type '{}'`. This showed that the `Database<typeof migrations>` utility was failing to infer the schema. It also made the API more verbose.

### Attempt 2: Fixing Schema Inference

The focus then shifted to the schema inference failure. The `Database` utility type was not correctly interpreting the structure of the `migrations` object. We tried several TypeScript techniques to make the type more specific:

-   `as const`
-   `satisfies Migrations`
-   A combination of both

-   **Outcome:** None of these approaches worked. The type utility seemed unable to extract the schema, suggesting the problem was deeper in the type logic itself. At this point, the complexity felt wrong, and hacking the types with `// @ts-expect-error` seemed like the only way forward, which was not an acceptable solution.

### Attempt 3 (The Solution): Inferring Types from the Source

After backtracking, we revisited the core problem. The user of `createDb` has to provide the `AppDatabase` type manually, but this type is derived from the migrations, which are a property of the `AppDurableObject`. The durable object itself is passed as an argument. All the necessary information was there; we just needed to teach TypeScript how to connect the dots.

The final and successful approach was to refactor `createDb` to be fully generic and infer the database type directly from the `durableObjectBinding` argument.

This was achieved with a series of conditional helper types:

1.  `InferDurableObjectFromNamespace`: Extracts the durable object class type from a `DurableObjectNamespace`.
2.  `MigrationsFromDurableObject`: Gets the `migrations` property type from the durable object class instance type.
3.  `DatabaseFromDurableObjectNamespace`: Composes the above helpers to generate the final `Database` schema type.

The signature of `createDb` was simplified to `createDb<DONS extends DurableObjectNamespace>(...)`, and the return type became `Kysely<DatabaseFromDurableObjectNamespace<DONS>>`.

## The Final Solution and Its Impact

This approach is a significant improvement for several reasons:

-   **Simplified API:** The end-user no longer needs to provide any explicit generic types. The call is now a simple `createDb(env.APP_DURABLE_OBJECT)`.
-   **Improved Type Safety:** The database schema is now inferred directly from the durable object, which is the single source of truth. This eliminates the possibility of providing a stale or incorrect `AppDatabase` type.
-   **Reduced Boilerplate:** The user no longer needs to manually define `AppDatabase` and `Todo` types based on the migrations. They can be inferred directly from the `db` constant using Kysely's built-in `InferDatabase` utility.

Although this is a **backwards-incompatible change**, it's justified for this experimental API. The improvement in developer experience, reduction in complexity, and increase in type safety are substantial. This change leads to a more robust and intuitive API.

### Addendum

Even with the improved type inference, a final TypeScript error remained: `Type 'AppDurableObject' is not assignable to type 'new (...args: any) => any'`.

This was caused by an incorrect type constraint that attempted to intersect an instance type (`SqliteDurableObject`) with a constructor type (`new (...)`), which is an impossible shape.

The solution was to define a `DatabaseDurableObjectConstructor` type that correctly models a class constructor that produces instances of `SqliteDurableObject`. This change resolved the final error and completed the type-safe refactoring.

## Subsequent Attempts and Current Approach

After the initial refactors, I explored multiple directions to reconcile Cloudflare's branded `DurableObjectNamespace` generic with our desire to infer the database schema from the durable object:

- Parameterizing the namespace with the durable object class and extracting `migrations` via `InstanceType`.
- Intersecting constructor and instance types to carry both brand and schema shape (rejected: impossible/fragile shapes).
- Currying `createDb` to separate database type and DO inference (rejected: backwards-incompatible).
- Overloads that keep a typed signature while using an unbranded implementation to avoid leaking the brand at runtime.

The branded types make fully structural typing brittle. The practical resolution is captured in the code context comment:

```2:27:sdk/src/runtime/lib/db/createDb.ts
// context(justinvdm, 2 Oct 2025): First prize would be a type parameter
// for the durable object and then use it for `durableObjectBinding`'s
// type, rather than casting like this. However, that would prevent
// users from being able to do createDb<InferredDbType> then though.
```

I left `createDb<DatabaseType>(binding: DurableObjectNamespace<any>, name)` and cast the binding internally to a `DurableObjectNamespace<SqliteDurableObject>`, which re-unifies the runtime call path while keeping the API surface that allows callers to supply an explicitly inferred database type. This avoids entangling the Cloudflare brand in our public generics while preserving the DX we want for the playgrounds and docs.

### PR-style Summary (Types Portion)

Problem:
- `createDb` needed to support both: (1) callers passing an explicitly inferred `DatabaseType`, and (2) durable object bindings branded by Cloudflare (`DurableObjectBranded`). Combining these produced constructor/brand constraints that TypeScript could not satisfy structurally.

Change:
- Simplified `createDb` to accept `DurableObjectNamespace<any>` and a generic `DatabaseType`.
- Inside the implementation, cast the namespace to `DurableObjectNamespace<SqliteDurableObject>` to call the RPC methods (`initialize`, `kyselyExecuteQuery`).
- Left a context note documenting the trade-off and the alternative we would prefer if we ever drop the need to pass an explicit `DatabaseType`.

Outcome:
- Playground `database-do` compiles and runs. Consumer code can continue to call:

```12:12:playground/database-do/src/db/db.ts
export const db = createDb<AppDatabase>(
  env.APP_DURABLE_OBJECT,
  "todo-database",
);
```

- Types remain precise for the database layer while avoiding dead-ends introduced by `DurableObjectBranded`.
- Future follow-up remains possible: re-introduce typed overloads that infer from the namespace once we no longer need callers to pass the database type explicitly.

## PR Description (Types: rwsdk/db for `database-do`)

### Previous state
`createDb` accepted a branded `DurableObjectNamespace` and a generic database type. The branded namespace ties the type to Cloudflare’s nominal type (`DurableObjectBranded`). The API also required callers to supply the database type explicitly.

In practice, this surfaced two classes of issues:
- Type inference loops and explosions when the database type was threaded through with complex conditional types (e.g. "type instantiation is excessively deep and possibly infinite").
- Mismatches between the durable object class and the namespace generic due to branding, which blocked structural matches and produced constructor-compatibility errors. Partial specification (user passes `T`, compiler must infer DO) made this worse because TypeScript won’t infer the remaining type parameter once one is supplied.

### What we tried
- Parameterizing the namespace with the durable object class and extracting the schema via `InstanceType<C>["migrations"]`.
- Intersecting constructor and instance shapes to carry both the brand and the migrations property.
- Currying `createDb` to separate the explicit database type from the DO inference path.
- Overloads to keep a strongly-typed signature while hiding the brand in the implementation.

These either reintroduced the brand into the public generic surface (causing assignability errors at the call site), or forced TypeScript into deep, brittle inference that collapsed to `{}` for the database shape.

### Current approach
Keep the explicit database type generic for callers and stop threading the DO brand through the public API. Concretely:
- `createDb<DatabaseType>(binding: DurableObjectNamespace<any>, name)`
- Inside the implementation, cast the binding to `DurableObjectNamespace<SqliteDurableObject>` to obtain the stub and call `initialize()` and `kyselyExecuteQuery()`.

This matches the context note left in code:

```2:27:sdk/src/runtime/lib/db/createDb.ts
// context(justinvdm, 2 Oct 2025): First prize would be a type parameter
// for the durable object and then use it for `durableObjectBinding`'s
// type, rather than casting like this. However, that would prevent
// users from being able to do createDb<InferredDbType> then though.
```

### Rationale
- Avoids entangling Cloudflare’s brand in our public generics while keeping the API that allows `createDb<InferredDbType>(env.APP_DURABLE_OBJECT, ...)`.
- Keeps runtime behavior straightforward by unifying on the `SqliteDurableObject` execution path.
- Keeps the database type precise where it matters (query layer), without requiring users to expose their DO class in type positions.

### Impact on consumer code
No change in usage pattern for `database-do`:

```12:12:playground/database-do/src/db/db.ts
export const db = createDb<AppDatabase>(
  env.APP_DURABLE_OBJECT,
  "todo-database",
);
```

### Status
With this change, the `database-do` playground compiles and runs; the seed script executes; the example works. Further work can revisit typed overloads that infer schema from the namespace if/when we no longer require callers to pass the database type explicitly.
