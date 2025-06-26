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
  onUpdate(action: "cascade" | "restrict" | "set null"): ColumnBuilder<T>;
  autoIncrement(): ColumnBuilder<T>;
  identity(): ColumnBuilder<T>;
  check(expression: any): ColumnBuilder<T>;
  generatedAlwaysAs(expression: any): ColumnBuilder<T>;
  generatedAlwaysAsIdentity(): ColumnBuilder<T>;
  generatedByDefaultAsIdentity(): ColumnBuilder<T>;
  stored(): ColumnBuilder<T>;
  modifyFront(modifier: any): ColumnBuilder<T>;
  nullsNotDistinct(): ColumnBuilder<T>;
  ifNotExists(): ColumnBuilder<T>;
  modifyEnd(modifier: any): ColumnBuilder<T>;
  $call<T>(func: (qb: this) => T): T;
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

export interface AlterColumnBuilder<T = any> {
  setDataType(dataType: string): AlteredColumnBuilder<T>;
  setDefault(value: any): AlteredColumnBuilder<T>;
  dropDefault(): AlteredColumnBuilder<T>;
  setNotNull(): AlteredColumnBuilder<T>;
  dropNotNull(): AlteredColumnBuilder<T>;
  $call<T>(func: (qb: this) => T): T;
}

export interface AlteredColumnBuilder<T = any> {
  // This builder is intentionally left almost empty to prevent chaining multiple alterations.
  // The only method is toOperationNode which is internal.
}

export type AlterColumnBuilderCallback = (
  builder: AlterColumnBuilder,
) => AlteredColumnBuilder;

export interface AlterTableBuilder<
  TName extends string,
  TSchema extends Record<string, any> = {},
> {
  readonly __tableName: TName;
  readonly __addedColumns: TSchema;
  renameTo(newTableName: string): AlterTableExecutor;
  setSchema(newSchema: string): AlterTableExecutor;
  alterColumn(
    column: string,
    alteration: AlterColumnBuilderCallback,
  ): AlterTableColumnAlteringBuilder;
  dropColumn(column: string): AlterTableColumnAlteringBuilder;
  renameColumn(
    column: string,
    newColumn: string,
  ): AlterTableColumnAlteringBuilder;
  addColumn<K extends string, T extends string>(
    name: K,
    type: T,
    build?: (
      col: ColumnBuilder<SqlToTsType<T>>,
    ) => ColumnBuilder<SqlToTsType<T>>,
  ): AlterTableBuilder<TName, Prettify<TSchema & Record<K, SqlToTsType<T>>>>;
  modifyColumn<K extends string, T extends string>(
    name: K,
    type: T,
    build?: (
      col: ColumnBuilder<SqlToTsType<T>>,
    ) => ColumnBuilder<SqlToTsType<T>>,
  ): AlterTableBuilder<TName, Prettify<TSchema & Record<K, SqlToTsType<T>>>>;
  addUniqueConstraint(
    constraintName: string,
    columns: string[],
    build?: (
      builder: UniqueConstraintNodeBuilder,
    ) => UniqueConstraintNodeBuilder,
  ): AlterTableExecutor;
  addCheckConstraint(
    constraintName: string,
    checkExpression: any,
    build?: (builder: CheckConstraintBuilder) => CheckConstraintBuilder,
  ): AlterTableExecutor;
  addForeignKeyConstraint(
    constraintName: string,
    columns: string[],
    targetTable: string,
    targetColumns: string[],
    build?: (
      builder: ForeignKeyConstraintBuilder,
    ) => ForeignKeyConstraintBuilder,
  ): AlterTableAddForeignKeyConstraintBuilder;
  addPrimaryKeyConstraint(
    constraintName: string,
    columns: string[],
    build?: (
      builder: PrimaryKeyConstraintBuilder,
    ) => PrimaryKeyConstraintBuilder,
  ): AlterTableExecutor;
  dropConstraint(constraintName: string): AlterTableDropConstraintBuilder;
  renameConstraint(
    oldName: string,
    newName: string,
  ): AlterTableDropConstraintBuilder;
  addIndex(indexName: string): AlterTableAddIndexBuilder;
  dropIndex(indexName: string): AlterTableExecutor;
  $call<T>(func: (qb: this) => T): T;
  execute(): ExecutedBuilder<this>;
}

export interface AlterTableAddForeignKeyConstraintBuilder {
  onDelete(
    onDelete: "cascade" | "restrict" | "set null",
  ): AlterTableAddForeignKeyConstraintBuilder;
  onUpdate(
    onUpdate: "cascade" | "restrict" | "set null",
  ): AlterTableAddForeignKeyConstraintBuilder;
  deferrable(): AlterTableAddForeignKeyConstraintBuilder;
  notDeferrable(): AlterTableAddForeignKeyConstraintBuilder;
  initiallyDeferred(): AlterTableAddForeignKeyConstraintBuilder;
  initiallyImmediate(): AlterTableAddForeignKeyConstraintBuilder;
  $call<T>(func: (qb: this) => T): T;
  execute(): Promise<void>;
}

export interface AlterTableAddIndexBuilder {
  unique(): AlterTableAddIndexBuilder;
  column(column: string): AlterTableAddIndexBuilder;
  columns(columns: string[]): AlterTableAddIndexBuilder;
  expression(expression: any): AlterTableAddIndexBuilder;
  using(indexType: string): AlterTableAddIndexBuilder;
  $call<T>(func: (qb: this) => T): T;
  execute(): Promise<void>;
}

export interface AlterTableColumnAlteringBuilder {
  alterColumn(
    column: string,
    alteration: AlterColumnBuilderCallback,
  ): AlterTableColumnAlteringBuilder;
  dropColumn(column: string): AlterTableColumnAlteringBuilder;
  renameColumn(
    column: string,
    newColumn: string,
  ): AlterTableColumnAlteringBuilder;
  addColumn<K extends string, T extends string>(
    columnName: K,
    dataType: T,
    build?: (
      col: ColumnBuilder<SqlToTsType<T>>,
    ) => ColumnBuilder<SqlToTsType<T>>,
  ): AlterTableColumnAlteringBuilder;
  modifyColumn<K extends string, T extends string>(
    columnName: K,
    dataType: T,
    build?: (
      col: ColumnBuilder<SqlToTsType<T>>,
    ) => ColumnBuilder<SqlToTsType<T>>,
  ): AlterTableColumnAlteringBuilder;
  execute(): Promise<void>;
}

export interface AlterTableDropConstraintBuilder {
  ifExists(): AlterTableDropConstraintBuilder;
  cascade(): AlterTableDropConstraintBuilder;
  restrict(): AlterTableDropConstraintBuilder;
  $call<T>(func: (qb: this) => T): T;
  execute(): Promise<void>;
}

export interface AlterTableExecutor {
  execute(): Promise<void>;
}

export interface CheckConstraintBuilder {
  $call<T>(func: (qb: this) => T): T;
}

export interface ColumnDefinitionBuilder {
  autoIncrement(): ColumnDefinitionBuilder;
  identity(): ColumnDefinitionBuilder;
  primaryKey(): ColumnDefinitionBuilder;
  references(ref: string): ColumnDefinitionBuilder;
  onDelete(
    onDelete: "cascade" | "restrict" | "set null",
  ): ColumnDefinitionBuilder;
  onUpdate(
    onUpdate: "cascade" | "restrict" | "set null",
  ): ColumnDefinitionBuilder;
  unique(): ColumnDefinitionBuilder;
  notNull(): ColumnDefinitionBuilder;
  unsigned(): ColumnDefinitionBuilder;
  defaultTo(value: any): ColumnDefinitionBuilder;
  check(expression: any): ColumnDefinitionBuilder;
  generatedAlwaysAs(expression: any): ColumnDefinitionBuilder;
  generatedAlwaysAsIdentity(): ColumnDefinitionBuilder;
  generatedByDefaultAsIdentity(): ColumnDefinitionBuilder;
  stored(): ColumnDefinitionBuilder;
  modifyFront(modifier: any): ColumnDefinitionBuilder;
  nullsNotDistinct(): ColumnDefinitionBuilder;
  ifNotExists(): ColumnDefinitionBuilder;
  modifyEnd(modifier: any): ColumnDefinitionBuilder;
  $call<T>(func: (qb: this) => T): T;
}

export interface CreateIndexBuilder {
  ifNotExists(): CreateIndexBuilder;
  unique(): CreateIndexBuilder;
  nullsNotDistinct(): CreateIndexBuilder;
  on(table: string): CreateIndexBuilder;
  column(column: string): CreateIndexBuilder;
  columns(columns: string[]): CreateIndexBuilder;
  expression(expression: any): CreateIndexBuilder;
  using(indexType: string): CreateIndexBuilder;
  where(lhs: any, op: any, rhs: any): CreateIndexBuilder;
  $call<T>(func: (qb: this) => T): T;
  execute(): Promise<void>;
}

export interface CreateSchemaBuilder {
  ifNotExists(): CreateSchemaBuilder;
  $call<T>(func: (qb: this) => T): T;
  execute(): Promise<void>;
}

export interface CreateTableBuilder<
  TName extends string,
  C extends string = never,
> {
  temporary(): CreateTableBuilder<TName, C>;
  onCommit(
    onCommit: "preserve rows" | "delete rows" | "drop",
  ): CreateTableBuilder<TName, C>;
  ifNotExists(): CreateTableBuilder<TName, C>;
  addColumn<CN extends string, T extends string>(
    columnName: CN,
    dataType: T,
    build?: (
      col: ColumnBuilder<SqlToTsType<T>>,
    ) => ColumnBuilder<SqlToTsType<T>>,
  ): CreateTableBuilder<TName, C | CN>;
  addPrimaryKeyConstraint(
    constraintName: string,
    columns: C[],
    build?: (
      builder: PrimaryKeyConstraintBuilder,
    ) => PrimaryKeyConstraintBuilder,
  ): CreateTableBuilder<TName, C>;
  addUniqueConstraint(
    constraintName: string,
    columns: C[],
    build?: (
      builder: UniqueConstraintNodeBuilder,
    ) => UniqueConstraintNodeBuilder,
  ): CreateTableBuilder<TName, C>;
  addCheckConstraint(
    constraintName: string,
    checkExpression: any,
    build?: (builder: CheckConstraintBuilder) => CheckConstraintBuilder,
  ): CreateTableBuilder<TName, C>;
  addForeignKeyConstraint(
    constraintName: string,
    columns: C[],
    targetTable: string,
    targetColumns: string[],
    build?: (
      builder: ForeignKeyConstraintBuilder,
    ) => ForeignKeyConstraintBuilder,
  ): CreateTableBuilder<TName, C>;
  modifyFront(modifier: any): CreateTableBuilder<TName, C>;
  modifyEnd(modifier: any): CreateTableBuilder<TName, C>;
  as(expression: any): CreateTableBuilder<TName, C>;
  $call<T>(func: (qb: this) => T): T;
  execute(): ExecutedBuilder<this>;
}

export interface CreateViewBuilder {
  temporary(): CreateViewBuilder;
  materialized(): CreateViewBuilder;
  ifNotExists(): CreateViewBuilder;
  orReplace(): CreateViewBuilder;
  columns(columns: string[]): CreateViewBuilder;
  as(query: any): CreateViewBuilder;
  $call<T>(func: (qb: this) => T): T;
  execute(): Promise<void>;
}

export interface DropIndexBuilder {
  on(table: string): DropIndexBuilder;
  ifExists(): DropIndexBuilder;
  cascade(): DropIndexBuilder;
  $call<T>(func: (qb: this) => T): T;
  execute(): Promise<void>;
}

export interface DropSchemaBuilder {
  ifExists(): DropSchemaBuilder;
  cascade(): DropSchemaBuilder;
  $call<T>(func: (qb: this) => T): T;
  execute(): Promise<void>;
}

export interface DropTableBuilder<TName extends string> {
  readonly __tableName: TName;
  ifExists(): DropTableBuilder<TName>;
  cascade(): DropTableBuilder<TName>;
  execute(): ExecutedBuilder<this>;
  $call<T>(func: (qb: this) => T): T;
}

export interface DropViewBuilder {
  materialized(): DropViewBuilder;
  ifExists(): DropViewBuilder;
  cascade(): DropViewBuilder;
  $call<T>(func: (qb: this) => T): T;
  execute(): Promise<void>;
}

export interface ForeignKeyConstraintBuilder {
  onDelete(
    onDelete: "cascade" | "restrict" | "set null",
  ): ForeignKeyConstraintBuilder;
  onUpdate(
    onUpdate: "cascade" | "restrict" | "set null",
  ): ForeignKeyConstraintBuilder;
  deferrable(): ForeignKeyConstraintBuilder;
  notDeferrable(): ForeignKeyConstraintBuilder;
  initiallyDeferred(): ForeignKeyConstraintBuilder;
  initiallyImmediate(): ForeignKeyConstraintBuilder;
  $call<T>(func: (qb: this) => T): T;
}

export interface PrimaryKeyConstraintBuilder {
  deferrable(): PrimaryKeyConstraintBuilder;
  notDeferrable(): PrimaryKeyConstraintBuilder;
  initiallyDeferred(): PrimaryKeyConstraintBuilder;
  initiallyImmediate(): PrimaryKeyConstraintBuilder;
  $call<T>(func: (qb: this) => T): T;
}

export interface RefreshMaterializedViewBuilder {
  concurrently(): RefreshMaterializedViewBuilder;
  withData(): RefreshMaterializedViewBuilder;
  withNoData(): RefreshMaterializedViewBuilder;
  $call<T>(func: (qb: this) => T): T;
  execute(): Promise<void>;
}

export interface UniqueConstraintNodeBuilder {
  nullsNotDistinct(): UniqueConstraintNodeBuilder;
  deferrable(): UniqueConstraintNodeBuilder;
  notDeferrable(): UniqueConstraintNodeBuilder;
  initiallyDeferred(): UniqueConstraintNodeBuilder;
  initiallyImmediate(): UniqueConstraintNodeBuilder;
  $call<T>(func: (qb: this) => T): T;
}

export interface SchemaBuilder {
  createTable<TName extends string>(
    name: TName,
  ): CreateTableBuilder<TName, never>;
  alterTable<TName extends string>(name: TName): AlterTableBuilder<TName, {}>;
  dropTable<TName extends string>(name: TName): DropTableBuilder<TName>;
  createIndex(name: string): CreateIndexBuilder;
  dropIndex(name: string): DropIndexBuilder;
  createSchema(schema: string): CreateSchemaBuilder;
  dropSchema(schema: string): DropSchemaBuilder;
  createView(viewName: string): CreateViewBuilder;
  refreshMaterializedView(viewName: string): RefreshMaterializedViewBuilder;
  dropView(viewName: string): DropViewBuilder;
}
