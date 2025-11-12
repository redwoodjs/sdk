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

## Implementation

I've implemented the solution according to the plan:

1. **Enhanced ColumnDefinitionBuilder**: Added `THasDefault` and `TIsAutoIncrement` type parameters that track metadata through the builder chain. Methods like `defaultTo()` set `THasDefault` to `true`, and `autoIncrement()` sets `TIsAutoIncrement` to `true`.

2. **Updated Operation Types**: Modified `AddColumnOp` and `ModifyColumnOp` to include `hasDefault` and `isAutoIncrement` flags alongside the existing `nullable` flag.

3. **Metadata-Rich Schema**: Changed the internal schema representation to use `ColumnDescriptor` objects that store `tsType`, `isNullable`, `hasDefault`, and `isAutoIncrement` for each column.

4. **Type Conversion Utilities**: Created `TableToSelectType`, `TableToInsertType`, and `TableToUpdateType` utilities that convert the descriptor-based schema to the appropriate type for each operation:
   - `TableToSelectType`: Converts descriptors to the select type (for backward compatibility)
   - `TableToInsertType`: Makes columns with `hasDefault` or `isAutoIncrement` optional
   - `TableToUpdateType`: Makes all columns optional

5. **Updated Database Type**: Modified the `Database` type to convert descriptors to select types for backward compatibility, and added `Insertable` and `Updatable` utility types that take the migrations type and table name.

6. **Updated Builders**: Modified `createTable` and `alterTable` builders to pass through the metadata when columns are defined.

7. **Added Type Tests**: Created comprehensive type tests for insert and update operations that verify columns with defaults and auto-increment are optional.

All type errors are resolved and the implementation is complete. The next step is to verify that existing tests still pass and that the new functionality works as expected.
