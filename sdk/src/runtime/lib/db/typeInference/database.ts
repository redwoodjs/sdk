import { Kysely } from "kysely";
import {
  ExecutedBuilder,
  Prettify,
  ProcessAlteredTable,
  UnionToTuple,
  UnionToIntersection,
} from "./utils";
import { CreateTableBuilder } from "./builders/createTable";
import { AlterTableBuilder } from "./builders/alterTable";
import { DropTableBuilder } from "./builders/dropTable";
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

export type BuildersFromMigration<TMigration extends Migration> =
  TMigration extends Migration<infer TUpReturn>
    ? Awaited<TUpReturn> extends Array<infer Item>
      ? GetBuilder<Item>
      : GetBuilder<Awaited<TUpReturn>>
    : never;

// --- Schema Inference Logic ---

export type AllBuilders<TMigrations extends Migrations> = BuildersFromMigration<
  TMigrations[keyof TMigrations]
>;

export type CreatedTables<TMigrations extends Migrations> = UnionToIntersection<
  ExtractTableSchema<
    Extract<AllBuilders<TMigrations>, CreateTableBuilder<any, any>>
  >
>;

type AllAlterBuilders<TMigrations extends Migrations> = Extract<
  AllBuilders<TMigrations>,
  AlterTableBuilder<any, any>
>;

type Flatten<T> = T extends [infer Head, ...infer Tail]
  ? [...(Head extends any[] ? Head : []), ...Flatten<Tail>]
  : [];

type ProcessAlterBuilderOps<TAll, TName extends string> =
  TAll extends AlterTableBuilder<TName, infer TOps> ? TOps : never;

export type AlteredTables<TMigrations extends Migrations> = {
  [TName in keyof CreatedTables<TMigrations> & string]: {
    __operations: Flatten<
      UnionToTuple<ProcessAlterBuilderOps<AllAlterBuilders<TMigrations>, TName>>
    >;
  };
};

type DroppedTableNames<TMigrations extends Migrations> =
  ExtractDroppedTableName<
    Extract<AllBuilders<TMigrations>, DropTableBuilder<any>>
  >;

type MergedSchema<TMigrations extends Migrations> = Prettify<
  {
    [TName in keyof CreatedTables<TMigrations>]: TName extends keyof AlteredTables<TMigrations>
      ? AlteredTables<TMigrations>[TName] extends { __operations: infer TOps }
        ? ProcessAlteredTable<CreatedTables<TMigrations>[TName], TOps>
        : CreatedTables<TMigrations>[TName]
      : CreatedTables<TMigrations>[TName];
  } & {
    [TName in keyof AlteredTables<TMigrations> as TName extends keyof CreatedTables<TMigrations>
      ? never
      : TName]: AlteredTables<TMigrations>[TName];
  }
>;

export type Database<TMigrations extends Migrations = Migrations> = Omit<
  MergedSchema<TMigrations>,
  DroppedTableNames<TMigrations>
>;

// --- Builder Extractors ---

export type ExtractTableSchema<T> =
  T extends CreateTableBuilder<infer TName, infer TSchema>
    ? Record<TName, TSchema>
    : never;

export type ExtractAlterSchema<T> =
  T extends AlterTableBuilder<infer TName, infer TOps>
    ? Record<TName, { __operations: TOps }>
    : never;

export type ExtractDroppedTableName<T> =
  T extends DropTableBuilder<infer TName> ? TName : never;
