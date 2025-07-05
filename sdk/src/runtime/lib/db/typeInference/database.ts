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

type Merge<U> = {
  [K in U extends infer T ? keyof T : never]: Prettify<
    UnionToIntersection<
      U extends Record<K, infer Alteration> ? Alteration : never
    >
  >;
};

export type AlteredTables<TMigrations extends Migrations> = Merge<
  ExtractAlterSchema<
    Extract<AllBuilders<TMigrations>, AlterTableBuilder<any, any>>
  >
>;

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
    AlteredTables<TMigrations>,
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
