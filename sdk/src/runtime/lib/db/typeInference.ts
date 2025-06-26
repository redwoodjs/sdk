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
  unsigned(): ColumnBuilder<T>;
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
  temporary(): this;
  ifNotExists(): this;
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
  dropColumn<K extends string>(
    name: K,
  ): AlterTableBuilder<TName, Prettify<TSchema & { [P in K]: never }>>;
  renameColumn<KFrom extends string, KTo extends string>(
    from: KFrom,
    to: KTo,
  ): AlterTableBuilder<
    TName,
    Prettify<TSchema & { [P in KFrom]: never } & { [P in KTo]: any }>
  >;
  execute(): ExecutedBuilder<this>;
}

export interface DropTableBuilder<TName extends string> {
  readonly __tableName: TName;
  ifExists(): DropTableBuilder<TName>;
  cascade(): DropTableBuilder<TName>;
  execute(): ExecutedBuilder<this>;
}

export interface CreateViewBuilder<
  TName extends string,
  TSchema extends Record<string, any> = {},
> {
  readonly __viewName: TName;
  readonly __schema: TSchema;
  withSchema<S extends Record<string, any>>(): CreateViewBuilder<TName, S>;
  temporary(): this;
  orReplace(): this;
  ifNotExists(): this;
  columns(columns: string[]): this;
  as(query: any): this;
  execute(): ExecutedBuilder<this>;
}

export interface DropViewBuilder<TName extends string> {
  readonly __viewName: TName;
  ifExists(): this;
  cascade(): this;
  execute(): ExecutedBuilder<this>;
}

export interface IndexBuilder {
  on(table: string): IndexBuilder;
  column(column: string): IndexBuilder;
  execute(): Promise<void>;
}

export interface DropIndexBuilder {
  on(table: string): this;
  ifExists(): this;
  cascade(): this;
  execute(): Promise<void>;
}

export interface SchemaBuilder {
  createTable<TName extends string>(name: TName): TableBuilder<TName, {}>;
  alterTable<TName extends string>(name: TName): AlterTableBuilder<TName, {}>;
  dropTable<TName extends string>(name: TName): DropTableBuilder<TName>;
  createIndex(name: string): IndexBuilder;
  createView<TName extends string>(name: TName): CreateViewBuilder<TName, {}>;
  dropView<TName extends string>(name: TName): DropViewBuilder<TName>;
  dropIndex(name: string): DropIndexBuilder;
}

export type ExtractTableSchema<T> =
  T extends TableBuilder<infer TName, infer TSchema>
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

type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (
  k: infer I,
) => void
  ? I
  : never;

type CreatedTables<TMigrations extends Migrations> = UnionToIntersection<
  ExtractTableSchema<Extract<AllBuilders<TMigrations>, TableBuilder<any, any>>>
>;

type CreatedViews<TMigrations extends Migrations> = UnionToIntersection<
  ExtractViewSchema<Extract<AllBuilders<TMigrations>, CreateViewBuilder<any, any>>>
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

type DroppedViewNames<TMigrations extends Migrations> =
  ExtractDroppedViewName<
    Extract<AllBuilders<TMigrations>, DropViewBuilder<any>>
  >;

type OmitNever<T> = { [K in keyof T as T[K] extends never ? never : K]: T[K] };

type AllCreated<TMigrations extends Migrations> = MergeSchemas<
  CreatedTables<TMigrations>,
  CreatedViews<TMigrations>
>;

type MergedSchemaBeforeDrop<TMigrations extends Migrations> = MergeSchemas<
  AllCreated<TMigrations>,
  AlteredTables<TMigrations>
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

export type Database<TMigrations extends Migrations = Migrations> = Prettify<
  InferredDatabase<TMigrations>
>;
