# Work Log: `rwsdk/db` End-to-End Test Setup

**Date:** 2025-10-02

## Problem

The primary goal is to establish a working end-to-end test for the `rwsdk/db` package, using the `playground/database-do` example as the testbed.

The initial blocker was a series of TypeScript errors in `playground/database-do/src/db/db.ts`, which prevented the project from compiling. After resolving those, a secondary blocker appeared: the database seed script fails to run due to module resolution errors.

## Investigation and Findings

### TypeScript Errors in `db.ts`

The investigation started with two complex TypeScript errors:
1.  `Type instantiation is excessively deep and possibly infinite.`
2.  `Argument of type 'DurableObjectNamespace<AppDurableObject>' is not assignable to parameter of type 'DurableObjectNamespace<SqliteDurableObject<any>>'.`

After a deep dive, two root causes were identified:

1.  **Generic Type Inference:** The `createDb` function signature (`createDb<T, DurableObject>`) required both type arguments to be specified if one was. The API, however, is designed for the user to only pass `T` explicitly (`createDb<AppDatabase>(...)`). This prevented TypeScript from inferring `DurableObject`, causing the errors. The solution was to explicitly pass both types: `createDb<AppDatabase, AppDurableObject>(...)`.

2.  **Schema Inference Failure:** After fixing the first issue, a new error surfaced: `Property 'todos' does not exist on type '{}'`. This indicated that the `Database<typeof migrations>` utility type was failing to infer the database schema from the migrations file. Several attempts to fix this by adjusting the typing of the `migrations` object (using `as const`, `satisfies`, etc.) were unsuccessful.

### Seed Script Module Resolution Failure

With the TypeScript errors temporarily bypassed, the next step was to run the database seed script. This failed with a module resolution error: `Can't resolve '@/db/durableObject'`.

The investigation revealed that the `rwsdk worker-run` script, which executes the seed file, does not resolve TypeScript path aliases (like `@/*`) from `tsconfig.json`.

An attempt was made to fix this by adding `tsconfig-paths-webpack-plugin` to the `enhanced-resolve` configuration within the `worker-run.mts` script. However, this did not resolve the issue, and the script continued to fail with the same error.

## Next Steps

This issue requires manual investigation. The intertwined problems of TypeScript's type inference and the script runner's module resolution create a complex situation that is not solvable with simple fixes. The next step will be a manual deep dive into the `rwsdk` build and scripting tools to find a robust solution.
