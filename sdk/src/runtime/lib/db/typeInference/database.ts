import { Kysely } from "kysely";
import {
  ExecutedBuilder,
  Prettify,
  MergeSchemas,
  OmitNever,
  UnionToIntersection,
  MergeAlteredTable,
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

type AllBuilders<TMigrations extends Migrations> = BuildersFromMigration<
  TMigrations[keyof TMigrations]
>;

type CreatedTables<TMigrations extends Migrations> = UnionToIntersection<
  ExtractTableSchema<
    Extract<AllBuilders<TMigrations>, CreateTableBuilder<any, any>>
  >
>;

type CreatedViews<TMigrations extends Migrations> = UnionToIntersection<
  ExtractViewSchema<
    Extract<AllBuilders<TMigrations>, CreateViewBuilder<any, any>>
  >
>;

type AlteredTables<TMigrations extends Migrations> = UnionToIntersection<
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

type MergedSchemaBeforeDrop<TMigrations extends Migrations> = {
  [K in
    | keyof AllCreated<TMigrations>
    | keyof AlteredTables<TMigrations>]: K extends keyof AllCreated<TMigrations>
    ? K extends keyof AlteredTables<TMigrations>
      ? MergeAlteredTable<
          AllCreated<TMigrations>[K],
          AlteredTables<TMigrations>[K]
        >
      : AllCreated<TMigrations>[K]
    : K extends keyof AlteredTables<TMigrations>
      ? AlteredTables<TMigrations>[K]
      : never;
};

type CleanedSchema<T> = {
  [K in keyof T]: Prettify<OmitNever<T[K]>>;
};

type InferredDatabase<TMigrations extends Migrations> = Omit<
  Omit<
    CleanedSchema<MergedSchemaBeforeDrop<TMigrations>>,
    DroppedTableNames<TMigrations>
  >,
  DroppedViewNames<TMigrations>
>;

export type Database<TMigrations extends Migrations = Migrations> = Prettify<
  InferredDatabase<TMigrations>
>;

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
