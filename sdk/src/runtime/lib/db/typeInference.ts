import { Kysely, DropTableBuilder as KyselyDropTableBuilder } from "kysely";

export type SqlToTsType<T extends string> = T extends "text"
  ? string
  : T extends "integer"
    ? number
    : T extends "blob"
      ? Uint8Array
      : T extends "real"
        ? number
        : never;

export interface ColumnBuilder<T = any> {
  primaryKey(): ColumnBuilder<T>;
  notNull(): ColumnBuilder<T>;
  unique(): ColumnBuilder<T>;
  defaultTo<V extends T>(value: V): ColumnBuilder<T>;
  references(ref: string): ColumnBuilder<T>;
  onDelete(action: "cascade" | "restrict" | "set null"): ColumnBuilder<T>;
}

type ExecutedBuilder<T> = Promise<void> & { __builder_type: T };

type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};

export interface TableBuilder<
  TName extends string,
  TSchema extends Record<string, any> = {},
> {
  readonly __tableName: TName;
  readonly __schema: TSchema;
  addColumn<K extends string, T extends string>(
    name: K,
    type: T,
    build?: (
      col: ColumnBuilder<SqlToTsType<T>>,
    ) => ColumnBuilder<SqlToTsType<T>>,
  ): TableBuilder<TName, Prettify<TSchema & Record<K, SqlToTsType<T>>>>;
  execute(): ExecutedBuilder<this>;
}

export interface AlterTableBuilder<
  TName extends string,
  TSchema extends Record<string, any> = {},
> {
  readonly __tableName: TName;
  readonly __addedColumns: TSchema;
  addColumn<K extends string, T extends string>(
    name: K,
    type: T,
    build?: (
      col: ColumnBuilder<SqlToTsType<T>>,
    ) => ColumnBuilder<SqlToTsType<T>>,
  ): AlterTableBuilder<TName, Prettify<TSchema & Record<K, SqlToTsType<T>>>>;
  execute(): ExecutedBuilder<this>;
}

export interface DropTableBuilder<TName extends string>
  extends KyselyDropTableBuilder {
  readonly __tableName: TName;
  ifExists(): DropTableBuilder<TName>;
  cascade(): DropTableBuilder<TName>;
  execute(): ExecutedBuilder<this>;
}

export interface IndexBuilder {
  on(table: string): IndexBuilder;
  column(column: string): IndexBuilder;
  execute(): Promise<void>;
}

export interface SchemaBuilder {
  createTable<TName extends string>(name: TName): TableBuilder<TName, {}>;
  alterTable<TName extends string>(name: TName): AlterTableBuilder<TName, {}>;
  dropTable<TName extends string>(name: TName): DropTableBuilder<TName>;
  createIndex(name: string): IndexBuilder;
}

export type ExtractTableSchema<T> =
  T extends TableBuilder<infer TName, infer TSchema>
    ? Record<TName, TSchema>
    : never;

export type ExtractAlterSchema<T> =
  T extends AlterTableBuilder<infer TName, infer TSchema>
    ? Record<TName, TSchema>
    : never;

export type ExtractDroppedTableName<T> =
  T extends DropTableBuilder<infer TName> ? TName : never;

export type MergeSchemas<A, B> = {
  [K in keyof A | keyof B]: K extends keyof A
    ? K extends keyof B
      ? Prettify<A[K] & B[K]>
      : A[K]
    : K extends keyof B
      ? B[K]
      : never;
};

export interface InferenceBuilder {
  schema: SchemaBuilder;
}

export type MigrationDatabase = InferenceBuilder & Kysely<any>;

export interface Migration<TUpReturn = unknown> {
  up(db: MigrationDatabase): TUpReturn;
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

type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (
  k: infer I,
) => void
  ? I
  : never;

type CreatedTables<TMigrations extends Migrations> = UnionToIntersection<
  ExtractTableSchema<Extract<AllBuilders<TMigrations>, TableBuilder<any, any>>>
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

type InferredDatabase<TMigrations extends Migrations> = Omit<
  MergeSchemas<CreatedTables<TMigrations>, AlteredTables<TMigrations>>,
  DroppedTableNames<TMigrations>
>;

export type Database<TMigrations extends Migrations = Migrations> = Prettify<
  InferredDatabase<TMigrations>
>;
