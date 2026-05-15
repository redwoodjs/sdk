# Database Type Inference

This document outlines the strategy used to provide strong, zero-config type safety for `rwsdk/db`. The system infers the complete database schema by statically analyzing the user's migration files at the type level, providing developers with full type safety and autocompletion without a code generation step.

## The Challenge: Avoiding Code Generation

Many database tools rely on a code generation step to provide type safety. While effective, this approach introduces several points of friction into the development process:

1.  **An Extra Step**: It requires the developer to run a command every time the schema changes, which is an easy step to forget and a common source of type-related errors.
2.  **Fragile Tooling**: The code generation process itself becomes another moving part that can fail. It can be sensitive to configuration (like file paths), and upgrades to the underlying tools can change the generated output, requiring workarounds.
3.  **Redundant Information**: Fundamentally, the database schema is already fully defined in the migration files. A code generation step is a workaround for a tool's inability to read this information directly.

The goal of `rwsdk/db`'s type system is to eliminate these problems by inferring the schema directly from the code that is already the source of truth: the migrations.

This presents two primary technical challenges: how to derive a final schema from a sequence of migrations, and how to represent that schema for different database operations, all at the type level.

### 1. Inferring a Schema from a Sequence of Changes

The database schema is not defined in a single file; it is the result of a sequence of migration files. The type system needed a way to compute the *final* state of the schema by simulating this entire migration process at compile time, without ever connecting to a database or executing runtime code.

### 2. Schemas for Different Operational Contexts

A single database table does not have a single, universal type. Its type signature changes depending on the operation being performed:

*   **For `select` operations**: When reading data, all columns are present as they exist in the database.
*   **For `insert` operations**: When creating a new record, columns that the database generates automatically (e.g., via `autoIncrement` or `defaultTo`) must be optional.
*   **For `update` operations**: When updating a record, all columns must be optional, as any subset of fields can be changed.

The type system needed to be able to generate and provide the correct type signature for each of these contexts.

### 3. Integrating with Kysely's Type System

The underlying database client, Kysely, has its own type system. To enable its `insert` and `update` type inference, it requires schema definitions to explicitly mark generated columns with a special `Generated<T>` utility type (e.g., `{ id: Generated<number> }`). This system is not designed to be extended by an external, dynamic type-inference engine like ours.

This created a challenge: our user-facing `Database` type must return plain, primitive types to ensure a simple developer experience (e.g., `type User = DB['users']`), but Kysely needed the `Generated<T>` wrappers to function correctly.

## The Solution

The solution is a multi-stage, purely type-level process that simulates the migrations to build a metadata-rich schema, which is then used to generate the different schema signatures required by both the developer and the underlying Kysely client.

### 1. Sequential Type-Level Migration Processing

The system's entry point is the `Database<TMigrations>` utility type. It works like a type-level state machine, using a series of nested utility types to transform the user's migrations into the final schema. The process is as follows:

1.  **Extract Builder Types**: The process starts by recursively iterating through the user's migration files. For each one, it inspects the return type of the `up` function to get an unresolved union of all the schema builders that were executed (e.g., `ExecutedBuilder<CreateTableBuilder<...>> | ExecutedBuilder<AlterTableBuilder<...>>`).

2.  **Convert Union to Tuple**: This union of builders is then converted into a tuple (an array-like type). This is a critical step, as it allows the type system to iterate through the builders one by one in a predictable order.

3.  **Build an Intermediate AST**: The system then iterates through this tuple of builders. The builders themselves are essentially type-level collectors that have gathered all the operations performed on them into an Abstract Syntax Tree (AST). For example, an `AlterTableBuilder` will have a list of all the `AddColumnOp` or `RenameColumnOp` types that were applied to it.

4.  **Apply Operations to Schema**: As the system iterates, a set of internal utility types (`ApplyBuilder`, `ProcessAlteredTable`) "applies" the operations from each builder's AST to the current schema type, producing the next state. This is where the schema is actually built, table by table, and column by column.

5.  **Prettify the Result**: Throughout this process, a `Prettify` utility type is used. This is a simple but important utility that takes a complex, nested, or intersectional type and flattens it into a single, clean object type. This ensures that the final output shown in tooltips and editor feedback is readable and easy to understand, rather than a long, unreadable generic type.

This entire process continues until all migrations have been simulated, resulting in a complete, internal representation of the final database schema, which is then ready for the final transformation step.

### 2. Rich Column Descriptors

The key to generating the different operational schemas is that the internal representation of the schema is not just a collection of plain TypeScript types. Instead, each column is represented by a rich `ColumnDescriptor` object that tracks the metadata lost during a simpler inference process:

```typescript
// Conceptual representation of a column's metadata
{
  tsType: number,
  isNullable: false,
  hasDefault: true,
  isAutoIncrement: false
}
```

By preserving this information, the system retains the knowledge of *how* a column is defined, which is essential for generating the different schema types.

### 3. The "Hidden Schema" for Kysely Integration

To resolve the conflict between the user-facing type and the type Kysely requires, the final `Database<T>` utility returns a type that contains both:

1.  **A User-Facing Schema:** The main properties of the `Database<T>` object are the plain table schemas (e.g., `db.users`). These are generated from the column descriptors and resolve to simple, primitive types (`string`, `number | null`), ensuring a clean developer experience.
2.  **A Kysely-Specific Schema:** A special `__kyselySchema` property is also included in the type. This property holds a version of the schema where generated columns *are* correctly wrapped in Kysely's `Generated<T>` utility type.

The `createDb<T>` function acts as the bridge. It is typed to detect the presence of the `__kyselySchema` property on the type it receives. It then passes this internal, metadata-rich schema to the `Kysely` constructor.

This approach provides Kysely with the schema information it needs under the hood, while the developer interacts with a clean, simple, and accurate set of types for all their database operations.
