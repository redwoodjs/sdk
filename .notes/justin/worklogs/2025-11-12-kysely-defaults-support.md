# 2025-11-12: Kysely `defaultTo` type inference

## Problem

Following on from the nullable columns fix, the type system still doesn't correctly handle columns with default values for insert and update operations. The current implementation only infers the "select" type for a table, which incorrectly requires developers to provide values for columns that the database would generate automatically (e.g., via `defaultTo` or `autoIncrement`).

My goal is to understand the current type inference architecture and devise a plan to extend it to support distinct types for insert, update, and select operations.

## Current Implementation Walkthrough

The current type inference system works like a state machine, processing migration files sequentially to build up the final database schema. It's a pure type-level process that doesn't execute any code.

Here's a high-level breakdown:

1.  **`Database<TMigrations>` Type**: This is the main entry point. It takes the user's `migrations` object and kicks off a recursive type-level process called `ProcessMigrations`.

2.  **`ProcessMigrations`**: This utility type iterates through each migration file, sorted by their keys (e.g., "001", "002"). For each migration, it determines what schema changes were made in the `up` function.

3.  **Builders as ASTs**: The schema builders (`createTable`, `alterTable`, etc.) don't actually *do* anything at runtime for the type system. Their purpose is to construct a "shape" or an Abstract Syntax Tree (AST) of the operations at the type level. For example, when you call `.alterTable('users').addColumn(...)`, the type system records an `AddColumnOp` in a tuple of operations associated with the `AlterTableBuilder`.

4.  **`ApplyBuilder`**: After extracting the list of builder operations from a migration, `ProcessMigrations` uses another utility, `ApplyBuilder`, to apply each operation to the current schema.
    *   `createTable` adds a new table to the schema type.
    *   `dropTable` removes one.
    *   `alterTable` is the most complex. It uses `ProcessAlteredTable` to recursively apply its list of column operations (`AddColumnOp`, `RenameColumnOp`, etc.) to the existing table's type.

5.  **Final Schema**: The end result is a single, "flattened" type that represents the final state of the database after all migrations have been applied.

The key takeaway is that the system cleverly uses TypeScript's generic and conditional types to simulate the migration process and compute the final schema.

## What's Lacking and a Proposed Solution

**The Core Problem**

The current system's main limitation is that it only computes the **final shape** of the data. It answers the question, "What does a row from this table look like when I select it?"

However, it discards the metadata that tells us *how* a column got its value. When `defaultTo()` is called, the system correctly infers that the column is not nullable, but it immediately forgets that a default value exists. This is why it can't distinguish between a column that is simply `NOT NULL` and one that is `NOT NULL DEFAULT ...`. This distinction is crucial for generating correct types for `insert` operations.

**Proposed Architectural Change**

To fix this, we need to evolve the system to track more metadata about each column. Instead of just storing the final TypeScript type, we need to store a "descriptor" object for each column that includes its properties.

Here's the plan:

1.  **Enrich the Column Information**: We'll change the internal representation of a column to store not just its type, but also flags for `isNullable`, `hasDefault`, and `isAutoIncrement`. The `ColumnDefinitionBuilder` will be updated to track this extra information at the type level.

2.  **Build a Metadata-Rich Schema**: The type inference engine (`ApplyBuilder`, etc.) will be modified to build an intermediate schema that contains this rich descriptor for every column. It will look something like this conceptually:

    ```typescript
    // The internal representation will become something like this:
    {
      users: {
        id: { tsType: number, isNullable: false, hasDefault: false, isAutoIncrement: true },
        status: { tsType: string, isNullable: false, hasDefault: true, isAutoIncrement: false },
        name: { tsType: string, isNullable: true, hasDefault: false, isAutoIncrement: false }
      }
    }
    ```

3.  **Generate Multiple Table Types**: Once we have this rich intermediate schema, we can easily generate the three different types we need for each table:
    *   A `Selectable` type (the default, what we have now).
    *   An `Insertable` type where `autoIncrement` and `defaultTo` columns are optional.
    *   An `Updatable` type where all columns are optional.

4.  **Update the Final `Database` Type**: The final `Database` type that the user interacts with will be updated to expose these different variations, likely making the `Selectable` version the default for simplicity and backward compatibility, while providing utility types to get the `Insertable` and `Updatable` versions.

This approach lets us keep the core of the existing sequential processing logic, but enhances it to capture the information we need. It's a surgical change that will give us the power to accurately model the database behavior for all CRUD operations.

### Implementation Constraint

Before starting the implementation, I need to adhere to a strict set of rules to ensure the change is non-disruptive for users.

1.  **No User Code Changes**: The user-facing API must remain identical. Existing code, like the `passkey` addon, which uses `Database<typeof migrations>` and `createDb<DB>()`, must continue to work without any modifications.
2.  **No Existing Test Changes**: All current type tests must continue to pass without any changes. The structure of the final `Database` type must remain a plain object with primitive types.
3.  **No Utility Type Wrappers in Final Output**: The final inferred `Database` type that users interact with cannot contain any special utility types or wrappers. It must resolve to simple, primitive TypeScript types (`string`, `number | null`, etc.) to ensure it doesn't break existing type assertions.
4.  **Changes Must Be Internal**: All modifications must be confined to the internal implementation of the type inference engine. The user experience and public-facing types are to be considered a stable, immutable contract.

## The `Generated<T>` Paradox and Its Resolution

After further analysis, I've identified the core technical challenge that was blocking progress.

**The Paradox**:

1.  For Kysely's `insertInto` and `updateTable` methods to correctly infer optional columns (for `autoIncrement` or `defaultTo`), the database schema type it receives must use Kysely's special `Generated<T>` type wrapper (e.g., `{ id: Generated<number> }`).
2.  However, our user-facing `Database<T>` type *must* return plain, primitive types (e.g., `{ id: number }`). If it returned the `Generated<T>` wrapper, it would be a major breaking change, complicating user code (`type User = DB['users']`) and failing all existing type tests.

The `Database<T>` type needed to be two different things at once, which seemed impossible without violating one of the core constraints.

**The Solution**:

The way to resolve this is to acknowledge that `createDb` must be involved, acting as a bridge between our clean user-facing type and the metadata-rich type Kysely needs.

1.  The `Database<T>` utility will be modified to return a shape that includes a special, "hidden" property (e.g., `__kyselySchema`).
2.  The main properties of the `Database<T>` type will remain the clean, primitive-based table schemas, ensuring no user code or existing type definitions break.
3.  The `__kyselySchema` property will contain a version of the database schema that *does* use the `Generated<T>` wrapper where appropriate.
4.  The `createDb<T>` function will be updated to detect this `__kyselySchema` property on the type it receives. It will then pass this metadata-rich schema to the `Kysely` constructor, while the user continues to interact with the clean `Database<T>` type.

This elegant solution allows us to provide Kysely with the information it needs, without polluting the user-facing API or breaking any of our strict implementation constraints.
