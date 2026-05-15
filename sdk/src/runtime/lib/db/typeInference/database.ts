import { Generated, Kysely } from "kysely";
import { AlterTableBuilder } from "./builders/alterTable";
import { CreateTableBuilder } from "./builders/createTable";
import { DropTableBuilder } from "./builders/dropTable";
import { SchemaBuilder } from "./builders/schema";
import {
  ExecutedBuilder,
  Prettify,
  ProcessAlteredTable,
  UnionToTuple,
} from "./utils";
import { ColumnDescriptor } from "./builders/columnDefinition";

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

// --- Sequential Schema Inference Logic ---

type ApplyBuilder<TSchema, TBuilder> =
  // Handle CreateTable
  TBuilder extends CreateTableBuilder<infer TName, infer TSch>
    ? Prettify<TSchema & Record<TName, TSch>>
    : // Handle DropTable
      TBuilder extends DropTableBuilder<infer TName>
      ? Omit<TSchema, TName>
      : // Handle AlterTable (including renames)
        TBuilder extends AlterTableBuilder<infer TName, infer TOps>
        ? TBuilder extends { __renamedFrom: infer From extends string }
          ? // It's a rename. The operations in TOps apply to the 'From' table.
            From extends keyof TSchema
            ? Prettify<
                Omit<TSchema, From> &
                  Record<TName, ProcessAlteredTable<TSchema[From], TOps>>
              >
            : TSchema // Renaming a non-existent table.
          : // It's not a rename. The operations apply to TName.
            TName extends keyof TSchema
            ? Prettify<
                Omit<TSchema, TName> &
                  Record<TName, ProcessAlteredTable<TSchema[TName], TOps>>
              >
            : TSchema // Altering a non-existent table.
        : TSchema;

type ApplyBuilders<TSchema, TBuildersTuple> = TBuildersTuple extends [
  infer THead,
  ...infer TRest,
]
  ? ApplyBuilders<ApplyBuilder<TSchema, THead>, TRest>
  : TSchema;

type ProcessMigrations<
  TMigrations extends Migrations,
  TKeys,
  TSchema = {},
> = TKeys extends [infer THeadKey, ...infer TRestKeys]
  ? THeadKey extends keyof TMigrations
    ? ProcessMigrations<
        TMigrations,
        TRestKeys,
        ApplyBuilders<
          TSchema,
          UnionToTuple<BuildersFromMigration<TMigrations[THeadKey]>>
        >
      >
    : TSchema
  : TSchema;

// --- Schema Transformation ---

type TableToSelectType<TTable> = Prettify<{
  [K in keyof TTable]: TTable[K] extends ColumnDescriptor
    ? TTable[K]["isNullable"] extends true
      ? TTable[K]["tsType"] | null
      : TTable[K]["tsType"]
    : TTable[K];
}>;

type TableToKyselySchema<TTable> = Prettify<{
  [K in keyof TTable]: TTable[K] extends ColumnDescriptor
    ? TTable[K]["hasDefault"] extends true
      ? Generated<
          TTable[K]["isNullable"] extends true
            ? TTable[K]["tsType"] | null
            : TTable[K]["tsType"]
        >
      : TTable[K]["isAutoIncrement"] extends true
        ? Generated<TTable[K]["tsType"]>
        : TTable[K]["isNullable"] extends true
          ? TTable[K]["tsType"] | null
          : TTable[K]["tsType"]
    : TTable[K];
}>;

type DatabaseWithDescriptors<TMigrations extends Migrations = Migrations> =
  ProcessMigrations<TMigrations, UnionToTuple<keyof TMigrations>>;

export type Database<TMigrations extends Migrations = Migrations> = Prettify<
  {
    [K in keyof DatabaseWithDescriptors<TMigrations>]: TableToSelectType<
      DatabaseWithDescriptors<TMigrations>[K]
    >;
  } & {
    __kyselySchema: {
      [K in keyof DatabaseWithDescriptors<TMigrations>]: TableToKyselySchema<
        DatabaseWithDescriptors<TMigrations>[K]
      >;
    };
  }
>;
