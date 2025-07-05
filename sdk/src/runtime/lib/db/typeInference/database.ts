import { Kysely } from "kysely";
import {
  ExecutedBuilder,
  Prettify,
  MergeSchemas,
  OmitNever,
  UnionToIntersection,
  FinalizeSchema,
  Cast,
} from "./utils";
import { CreateTableBuilder } from "./builders/createTable";
import { CreateViewBuilder } from "./builders/createView.js";
import { AlterTableBuilder } from "./builders/alterTable.js";
import { DropTableBuilder } from "./builders/dropTable.js";
import { DropViewBuilder } from "./builders/dropView.js";
import { SchemaBuilder } from "./builders/schema";

export interface InferenceBuilder {
  schema: SchemaBuilder;
}

export type MigrationBuilder = InferenceBuilder & Kysely<any>;

export interface Migration<TUpReturn = unknown> {
  up(db: MigrationBuilder): TUpReturn;
  down?(db: Kysely<any>): any;
}

export type Migrations = Record<string, Migration>;

type GetBuilder<T> = T extends ExecutedBuilder<infer B> ? B : never;

type BuildersFromMigration<TMigration extends Migration> =
  TMigration extends Migration<infer TUpReturn>
    ? Awaited<TUpReturn> extends Array<infer Item>
      ? GetBuilder<Item>
      : GetBuilder<Awaited<TUpReturn>>
    : never;

export type AllBuilders<TMigrations extends Migrations> = BuildersFromMigration<
  TMigrations[keyof TMigrations]
>;

export type CreatedTables<TMigrations extends Migrations> = UnionToIntersection<
  ExtractTableSchema<
    Extract<AllBuilders<TMigrations>, CreateTableBuilder<any, any>>
  >
>;

export type CreatedViews<TMigrations extends Migrations> = UnionToIntersection<
  ExtractViewSchema<
    Extract<AllBuilders<TMigrations>, CreateViewBuilder<any, any>>
  >
>;

export type AlteredTables<TMigrations extends Migrations> = ExtractAlterSchema<
  Extract<AllBuilders<TMigrations>, AlterTableBuilder<any, any>>
>;

// --- START: Sequential Alteration Processing ---

// This is the new entry point that replaces the old AlteredTables logic.
// It finds all tables that have been altered across all migrations,
// then processes each one sequentially.
type FinalAlteredTables<TMigrations extends Migrations> = {
  // Get all unique table names that have been altered.
  [TTableName in AlteredTables<TMigrations> extends infer U
    ? U extends {}
      ? keyof U
      : never
    : never]: {
    // For each table, create a list of all operations from all migrations in order.
    __operations: Prettify<
      // We do this with a recursive type that iterates through the sorted migration keys.
      Cast<
        SequentiallyProcessTable<
          TTableName,
          // We assume the keys are alphabetically sorted, which TS does for string literals.
          (keyof TMigrations)[],
          TMigrations
        >,
        any[] // Cast to any[] to satisfy the compiler, we know it's an array of operations.
      >
    >;
  };
};

// Recursively processes migrations for a single table, composing their alterations.
type SequentiallyProcessTable<
  TTableName extends string,
  TMigrationKeys extends PropertyKey[],
  TMigrations extends Migrations,
> = TMigrationKeys extends [
  infer TKey extends keyof TMigrations,
  ...infer TRest extends (keyof TMigrations)[],
]
  ? // Concat the operations from the current migration with the operations from the rest.
    [
      ...GetOpsFromMigration<TTableName, TMigrations[TKey]>,
      ...SequentiallyProcessTable<TTableName, TRest, TMigrations>,
    ]
  : [];

// Helper to extract the operations list for a specific table from a single migration.
type GetOpsFromMigration<
  TTableName extends string,
  TMigration extends Migration,
> =
  ExtractAlterSchema<
    Extract<
      BuildersFromMigration<TMigration>,
      AlterTableBuilder<TTableName, any>
    >
  > extends infer Alteration extends Record<TTableName, { __operations: any[] }>
    ? Alteration[TTableName]["__operations"]
    : [];

// --- END: Sequential Alteration Processing ---

type DroppedTableNames<TMigrations extends Migrations> =
  ExtractDroppedTableName<
    Extract<AllBuilders<TMigrations>, DropTableBuilder<any>>
  >;

type DroppedViewNames<TMigrations extends Migrations> = ExtractDroppedViewName<
  Extract<AllBuilders<TMigrations>, DropViewBuilder<any>>
>;

type AllCreated<TMigrations extends Migrations> = MergeSchemas<
  CreatedTables<TMigrations>,
  CreatedViews<TMigrations>
>;

type RenamedTables<TMigrations extends Migrations> = Extract<
  AllBuilders<TMigrations>,
  { __renamedFrom: string }
>;

type TableRenameMap<TMigrations extends Migrations> = UnionToIntersection<{
  [B in RenamedTables<TMigrations> as B extends {
    __renamedFrom: infer From extends string;
  }
    ? From
    : never]: B extends { __tableName: infer TName } ? TName : never;
}>;

export type MergedSchemaBeforeDrop<TMigrations extends Migrations> =
  FinalizeSchema<
    AllCreated<TMigrations>,
    FinalAlteredTables<TMigrations>,
    TableRenameMap<TMigrations>
  >;

type CleanedSchema<T> = {
  [K in keyof T]: OmitNever<T[K]>;
};

type InferredDatabase<TMigrations extends Migrations> = Omit<
  Omit<
    CleanedSchema<MergedSchemaBeforeDrop<TMigrations>>,
    DroppedTableNames<TMigrations>
  >,
  DroppedViewNames<TMigrations>
>;

type OmitNeverTables<T> = {
  [K in keyof T as T[K] extends never ? never : K]: T[K];
};

export type Database<TMigrations extends Migrations = Migrations> =
  OmitNeverTables<InferredDatabase<TMigrations>>;

export type ExtractTableSchema<T> =
  T extends CreateTableBuilder<infer TName, infer TSchema>
    ? Record<TName, TSchema>
    : never;

export type ExtractViewSchema<T> =
  T extends CreateViewBuilder<infer TName, infer TSchema>
    ? Record<TName, TSchema>
    : never;

export type ExtractAlterSchema<T> =
  T extends AlterTableBuilder<infer TName, infer TOps>
    ? Record<TName, { __operations: TOps }>
    : never;

export type ExtractDroppedTableName<T> =
  T extends DropTableBuilder<infer TName> ? TName : never;

export type ExtractDroppedViewName<T> =
  T extends DropViewBuilder<infer TName> ? TName : never;

type FinalizeAlters<TAll, TAltered> = {
  [TableName in keyof TAll | keyof TAltered]: TableName extends keyof TAltered
    ? TableName extends keyof TAll
      ? ProcessAlteredTable<TAll[TableName], TAltered[TableName]>
      : TAltered[TableName]
    : TableName extends keyof TAll
      ? TAll[TableName]
      : never;
};

export type FinalizeSchema<TAll, TAltered, TRenames> =
  TAll extends Record<string, any> ? FinalizeAlters<TAll, TAltered> : never;
