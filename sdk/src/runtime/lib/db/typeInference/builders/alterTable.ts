import {
  SqlToTsType,
  ExecutedBuilder,
  Prettify,
  RemoveNeverValues,
} from "../utils";
import { ColumnDefinitionBuilder } from "./columnDefinition";
import { AlterColumnBuilderCallback } from "./alterColumn";
import {
  AlterTableBuilder as KyselyAlterTableBuilder,
  ForeignKeyConstraintBuilder,
  Expression,
} from "kysely";
import type { Assert, AssertStillImplements } from "../assert";

export interface AlterTableBuilder<
  TName extends string,
  TSchema extends Record<string, any> = {},
> {
  readonly __tableName: TName;
  readonly __addedColumns: TSchema;
  renameTo<TNewName extends string>(
    newTableName: TNewName,
  ): AlterTableBuilder<TNewName, TSchema>;
  setSchema(newSchema: string): AlterTableBuilder<TName, TSchema>;
  addColumn<K extends string, T extends string>(
    name: K,
    type: T,
    build?: (
      col: ColumnDefinitionBuilder<SqlToTsType<T>>,
    ) => ColumnDefinitionBuilder<SqlToTsType<T>>,
  ): AlterTableBuilder<
    TName,
    Prettify<RemoveNeverValues<TSchema> & Record<K, SqlToTsType<T>>>
  >;
  dropColumn<K extends keyof TSchema>(
    name: K,
  ): AlterTableBuilder<TName, Prettify<Omit<TSchema, K>>>;
  renameColumn<KFrom extends keyof TSchema, KTo extends string>(
    from: KFrom,
    to: KTo,
  ): AlterTableBuilder<
    TName,
    Prettify<Omit<TSchema, KFrom> & { [P in KTo]: TSchema[KFrom] }>
  >;
  alterColumn<K extends string>(
    column: K,
    alteration: AlterColumnBuilderCallback,
  ): AlterTableBuilder<TName, TSchema>;
  modifyColumn<K extends string, T extends string>(
    column: K,
    type: T,
    build?: (
      col: ColumnDefinitionBuilder<SqlToTsType<T>>,
    ) => ColumnDefinitionBuilder<SqlToTsType<T>>,
  ): AlterTableBuilder<TName, Prettify<TSchema & Record<K, SqlToTsType<T>>>>;
  addUniqueConstraint(
    constraintName: string,
    columns: (keyof TSchema)[],
  ): AlterTableBuilder<TName, TSchema>;
  addPrimaryKeyConstraint(
    constraintName: string,
    columns: (keyof TSchema)[],
  ): AlterTableBuilder<TName, TSchema>;
  addCheckConstraint(
    constraintName: string,
    checkExpression: Expression<any>,
  ): AlterTableBuilder<TName, TSchema>;
  addForeignKeyConstraint(
    constraintName: string,
    columns: (keyof TSchema)[],
    targetTable: string,
    targetColumns: string[],
    build?: (
      builder: ForeignKeyConstraintBuilder,
    ) => ForeignKeyConstraintBuilder,
  ): AlterTableBuilder<TName, TSchema>;
  dropConstraint(constraintName: string): AlterTableBuilder<TName, TSchema>;
  renameConstraint(
    oldName: string,
    newName: string,
  ): AlterTableBuilder<TName, TSchema>;
  addIndex(indexName: string): AlterTableBuilder<TName, TSchema>;
  dropIndex(indexName: string): AlterTableBuilder<TName, TSchema>;
  execute(): Promise<ExecutedBuilder<this>>;
  $call<T>(func: (qb: this) => T): T;
}

/*
type _Assert = Assert<
  AssertStillImplements<AlterTableBuilder<any, any>, KyselyAlterTableBuilder>
>;
*/
