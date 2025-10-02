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
