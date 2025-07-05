import { Kysely } from "kysely";
import {
  ExecutedBuilder,
  Prettify,
  MergeSchemas,
  OmitNever,
  UnionToIntersection,
  FinalizeSchema,
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

// Takes two alteration schemas for a single table and composes them.
// This is the core of building the AST across migrations.
type RenamedKeys<TLeft, TRight> = {
  [K in keyof TRight]: TRight[K] extends { __renamed: infer RFrom }
    ? RFrom extends keyof TLeft
      ? RFrom
      : never
    : never;
}[keyof TRight];

type ComposeAlteration<TLeft, TRight> = Prettify<
  Omit<TLeft, RenamedKeys<TLeft, TRight>> & {
    [K in keyof TRight]: TRight[K] extends { __renamed: infer RFrom }
      ? RFrom extends keyof TLeft
        ? { __renamed: TLeft[RFrom] }
        : TRight[K]
      : TRight[K];
  }
>;

// Composes two full sets of altered tables.
type ComposeAlteredTables<TLeft, TRight> = Prettify<
  Omit<TLeft, keyof TRight> & {
    [K in keyof TRight]: K extends keyof TLeft
      ? ComposeAlteration<TLeft[K], TRight[K]>
      : TRight[K];
  }
>;

// Recursively processes migrations for a single table, composing their alterations.
type SequentiallyProcessTable<
  TTableName extends string,
  TMigrationKeys extends PropertyKey[],
  TMigrations extends Migrations,
> = TMigrationKeys extends [
  infer TKey extends keyof TMigrations,
  ...infer TRest extends (keyof TMigrations)[],
]
  ? ComposeAlteration<
      ExtractAlterSchema<
        Extract<
          BuildersFromMigration<TMigrations[TKey]>,
          AlterTableBuilder<TTableName, any>
        >
      > extends infer Alteration extends Record<TTableName, any>
        ? Alteration[TTableName]
        : {},
      SequentiallyProcessTable<TTableName, TRest, TMigrations>
    >
  : {};

// This is the new entry point that replaces the old AlteredTables logic.
// It finds all tables that have been altered across all migrations,
// then processes each one sequentially.
export type FinalAlteredTables<TMigrations extends Migrations> = {
  [TTableName in AlteredTables<TMigrations> extends infer U
    ? U extends {}
      ? keyof U
      : never
    : never]: SequentiallyProcessTable<
    TTableName,
    // We assume the keys are alphabetically sorted, which TS does for string literals.
    // This is a limitation but inherent to the problem.
    (keyof TMigrations)[],
    TMigrations
  >;
};

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
  T extends AlterTableBuilder<infer TName, infer TSchema>
    ? Record<TName, TSchema>
    : never;

export type ExtractDroppedTableName<T> =
  T extends DropTableBuilder<infer TName> ? TName : never;

export type ExtractDroppedViewName<T> =
  T extends DropViewBuilder<infer TName> ? TName : never;
