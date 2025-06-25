import { Kysely } from "kysely";

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

export type ExecutedBuilder<T> = Promise<void> & { __builder_type: T };

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

type RenameProperties<T, R extends Record<string, string>> = Prettify<{
  [P in keyof T as P extends keyof R ? R[P] : P]: T[P];
}>;

export interface AlterTableBuilder<
  TName extends string,
  TAddedColumns extends Record<string, any> = {},
  TDroppedColumns extends string = never,
  TRenamedColumns extends Record<string, string> = {},
> {
  readonly __tableName: TName;
  readonly __addedColumns: TAddedColumns;
  readonly __droppedColumns: TDroppedColumns;
  readonly __renamedColumns: TRenamedColumns;
  addColumn<K extends string, T extends string>(
    name: K,
    type: T,
    build?: (
      col: ColumnBuilder<SqlToTsType<T>>,
    ) => ColumnBuilder<SqlToTsType<T>>,
  ): AlterTableBuilder<
    TName,
    Prettify<TAddedColumns & Record<K, SqlToTsType<T>>>,
    TDroppedColumns,
    TRenamedColumns
  >;
  dropColumn<K extends string>(
    name: K,
  ): AlterTableBuilder<
    TName,
    TAddedColumns,
    TDroppedColumns | K,
    TRenamedColumns
  >;
  renameColumn<F extends string, T extends string>(
    from: F,
    to: T,
  ): AlterTableBuilder<
    TName,
    TAddedColumns,
    TDroppedColumns,
    Prettify<TRenamedColumns & Record<F, T>>
  >;
  execute(): ExecutedBuilder<this>;
}

export interface DropTableBuilder<TName extends string> {
  readonly __tableName: TName;
  ifExists(): DropTableBuilder<TName>;
  execute(): ExecutedBuilder<this>;
}

export interface RenameTableBuilder<TFrom extends string, TTo extends string> {
  readonly __from: TFrom;
  readonly __to: TTo;
  execute(): ExecutedBuilder<this>;
}

export interface IndexBuilder {
  on(table: string): IndexBuilder;
  column(column: string): IndexBuilder;
  execute(): Promise<void>;
}

export interface SchemaBuilder {
  createTable<TName extends string>(name: TName): TableBuilder<TName, {}>;
  alterTable<TName extends string>(
    name: TName,
  ): AlterTableBuilder<TName, {}, never, {}>;
  dropTable<TName extends string>(name: TName): DropTableBuilder<TName>;
  renameTable<TFrom extends string, TTo extends string>(
    from: TFrom,
    to: TTo,
  ): RenameTableBuilder<TFrom, TTo>;
  createIndex(name: string): IndexBuilder;
}

type ApplyBuilder<DB, B> =
  B extends TableBuilder<infer TN, infer TS>
    ? Prettify<DB & Record<TN, TS>>
    : B extends AlterTableBuilder<infer TN, infer AS, infer DS, infer RS>
      ? Prettify<
          Omit<DB, TN> &
            Record<
              TN,
              Prettify<
                (TN extends keyof DB
                  ? RenameProperties<Omit<DB[TN], DS>, RS>
                  : {}) &
                  AS
              >
            >
        >
      : B extends DropTableBuilder<infer TN>
        ? Prettify<Omit<DB, TN>>
        : B extends RenameTableBuilder<infer From, infer To>
          ? Prettify<
              Omit<DB, From> & Record<To, From extends keyof DB ? DB[From] : {}>
            >
          : DB;

type ApplyBuilders<DB, Bs extends any[]> = Bs extends [
  ExecutedBuilder<infer B>,
  ...infer Rest,
]
  ? ApplyBuilders<ApplyBuilder<DB, B>, Rest>
  : DB;

type UnwrapPromise<T> = T extends Promise<infer U> ? U : T;

type ApplyUpResult<DB, R> =
  UnwrapPromise<R> extends ExecutedBuilder<infer B>
    ? ApplyBuilder<DB, B>
    : UnwrapPromise<R> extends ExecutedBuilder<any>[]
      ? ApplyBuilders<DB, UnwrapPromise<R>>
      : DB;

type ApplyMigration<DB, M extends Migration> =
  M extends Migration<infer R> ? ApplyUpResult<DB, R> : DB;

export type ComputeDatabase<
  Migrations extends readonly Migration[],
  DB = {},
> = Migrations extends readonly [
  infer M extends Migration,
  ...infer Rest extends readonly Migration[],
]
  ? ComputeDatabase<Rest, ApplyMigration<DB, M>>
  : DB;

export interface MigrationDatabase {
  schema: SchemaBuilder;
}

export interface Migration<TUpReturn = unknown> {
  up(db: MigrationDatabase): TUpReturn;
  down?(db: Kysely<any>): any;
}

export type Migrations = Record<string, Migration>;

type Values<T> = T[keyof T];
type MigrationsToArray<T extends Migrations> = Values<T>[];
export type Database<T extends Migrations> = ComputeDatabase<
  MigrationsToArray<T>
>;
