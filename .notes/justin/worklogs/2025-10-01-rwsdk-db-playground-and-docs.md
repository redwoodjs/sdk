# 2025-10-01: rwsdk/db Playground Example and Documentation

## Problem

The `rwsdk/db` feature lacks a dedicated playground example to demonstrate its usage and test its functionality. The documentation also needs a section on how to seed the database.

## Plan

1.  Create a new playground example named `database-do`.
2.  Implement the database setup as described in the documentation.
3.  Add a database schema and migrations for a to-do list.
4.  Create a seeding script to populate the database with initial data.
5.  Build a simple UI to display, add, and toggle to-do items.
6.  Write end-to-end tests to verify database operations (create, read, update, toggle).
7.  Update the `rwsdk/db` documentation to include a section on seeding, using the new to-do list example as a reference.

---

## PR Description

**Title:** fix: Improve `rwsdk/db` types and `worker-run` script

**Description:**

This change improves the developer experience for `rwsdk/db` by addressing two distinct but related issues: it simplifies the type signature for `createDb` to be more stable, and it refactors the `worker-run` command to be more robust. Together, these changes make setting up and seeding a database a more reliable process.

---

### Fixing `createDb` Type Instantiation

**Problem**

The previous type signature for `createDb` attempted to infer the database schema directly from the Durable Object class provided. While well-intentioned, this approach entangled the public API with Cloudflare’s internal `DurableObjectBranded` nominal type.

This created two main issues for developers:
1.  **Type Instantiation Loops**: When the inferred database type was used in complex conditional types, it often led to TypeScript errors like "type instantiation is excessively deep and possibly infinite."
2.  **Branded Type Mismatches**: The brand on the `DurableObjectNamespace` type prevented structural matching, causing constructor-compatibility errors even when the shapes were correct.

**Solution**

The `createDb` signature is simplified to decouple it from the Durable Object implementation details. The new signature is: `createDb<DatabaseType>(binding: DurableObjectNamespace<any>, name)`.

Instead of inferring the schema, it now requires the database type to be passed explicitly. This removes the brittle inference path and avoids exposing Cloudflare's branded types in the public API. Internally, the binding is cast to the expected `SqliteDurableObject` type to perform the necessary operations. This keeps the type safety at the query layer, which is where it matters most, without causing conflicts at the call site.

---

### Executing Worker Scripts

**Problem**

The development server creates an isolated sandbox environment that emulates the Cloudflare Workers runtime using Miniflare. For tasks like database seeding, scripts need to run *inside* this sandbox to access the correct database bindings and use the same clients (like Kysely or Prisma) as the application.

**Previous Implementation**

The initial `rwsdk worker-run` command tried to solve this by creating a synthetic, temporary worker environment. It parsed the user's `src/worker.tsx`, generated a virtual entry point with the necessary Durable Object exports, and spun up a minimal Vite server.

This implementation broke down because its module resolution was too simplistic. It could not correctly handle common project configurations like `tsconfig.json` path aliases (e.g., `@/*`), causing resolution to fail and creating an inconsistent execution environment.

**New Implementation**

The new solution provides a direct bridge into the user's actual development sandbox.

1.  **Leverage the User's Dev Server**: The `rwsdk worker-run` command now starts the user's real Vite dev server by loading their `vite.config.mts` file. This ensures the execution environment is identical to the one used for development, respecting all aliases and plugins.
2.  **Introduce a `/__worker-run` Endpoint**: A special, dev-only route is added to the worker's fetch handler.
3.  **Execute via `fetch`**: The `worker-run` command sends a `fetch` request to this endpoint, passing the path to the target script as a URL query parameter. The handler then uses a dynamic `import()` to load and execute the script inside the running worker.

This method removes the fragile resolution logic and ensures that scripts run with the exact same configuration and context as the main application.
