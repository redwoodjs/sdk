import { SqlToTsType, ExecutedBuilder, Prettify, OmitNever } from "../utils";
import { ColumnDefinitionBuilder } from "./columnDefinition";
import { AlterColumnBuilderCallback } from "./alterColumn";
import {
  AlterTableBuilder as KyselyAlterTableBuilder,
  ForeignKeyConstraintBuilder,
  Expression,
  CheckConstraintNode,
  UniqueConstraintNode,
  PrimaryKeyConstraintNode,
  sql,
} from "kysely";
import type { Assert, AssertStillImplements } from "../assert";

type DataTypeExpression = string | typeof sql;

type MapAlterationToSchema<
  K extends string,
  TAlteration,
> = TAlteration extends {
  kind: "setDataType";
  dataType: infer T extends DataTypeExpression;
}
  ? { [P in K]: SqlToTsType<T> }
  : {};

interface CheckConstraintBuilder {
  $call<T>(func: (qb: this) => T): T;
  toOperationNode(): CheckConstraintNode;
}

interface UniqueConstraintBuilder {
  nullsNotDistinct(): UniqueConstraintBuilder;
  deferrable(): UniqueConstraintBuilder;
  notDeferrable(): UniqueConstraintBuilder;
  initiallyDeferred(): UniqueConstraintBuilder;
  initiallyImmediate(): UniqueConstraintBuilder;
  $call<T>(func: (qb: this) => T): T;
  toOperationNode(): UniqueConstraintNode;
}

interface PrimaryKeyConstraintBuilder {
  deferrable(): PrimaryKeyConstraintBuilder;
  notDeferrable(): PrimaryKeyConstraintBuilder;
  initiallyDeferred(): PrimaryKeyConstraintBuilder;
  initiallyImmediate(): PrimaryKeyConstraintBuilder;
  $call<T>(func: (qb: this) => T): T;
  toOperationNode(): PrimaryKeyConstraintNode;
}

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
  addColumn<K extends string, T extends DataTypeExpression>(
    name: K,
    type: T,
    build?: (
      col: ColumnDefinitionBuilder<SqlToTsType<T>>,
    ) => ColumnDefinitionBuilder<SqlToTsType<T>>,
  ): AlterTableBuilder<
    TName,
    Prettify<OmitNever<TSchema> & Record<K, SqlToTsType<T>>>
  >;
  dropColumn<K extends string>(
    name: K,
  ): AlterTableBuilder<TName, TSchema & { [P in K]: never }>;
  renameColumn<KFrom extends string, KTo extends string>(
    from: KFrom,
    to: KTo,
  ): AlterTableBuilder<TName, TSchema & { [P in KTo]: { __renamed: KFrom } }>;
  alterColumn<K extends string>(
    column: K,
    alteration: AlterColumnBuilderCallback,
  ): AlterTableBuilder<TName, TSchema>;
  modifyColumn<K extends string, T extends DataTypeExpression>(
    column: K,
    type: T,
    build?: (
      col: ColumnDefinitionBuilder<SqlToTsType<T>>,
    ) => ColumnDefinitionBuilder<SqlToTsType<T>>,
  ): AlterTableBuilder<TName, Prettify<TSchema & Record<K, SqlToTsType<T>>>>;
  addUniqueConstraint(
    constraintName: string,
    columns: string[],
    build?: (builder: UniqueConstraintBuilder) => UniqueConstraintBuilder,
  ): AlterTableBuilder<TName, TSchema>;
  addPrimaryKeyConstraint(
    constraintName: string,
    columns: string[],
    build?: (
      builder: PrimaryKeyConstraintBuilder,
    ) => PrimaryKeyConstraintBuilder,
  ): AlterTableBuilder<TName, TSchema>;
  addCheckConstraint(
    constraintName: string,
    checkExpression: Expression<any>,
    build?: (builder: CheckConstraintBuilder) => CheckConstraintBuilder,
  ): AlterTableBuilder<TName, TSchema>;
  addForeignKeyConstraint(
    constraintName: string,
    columns: string[],
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

type _Assert = Assert<
  AssertStillImplements<AlterTableBuilder<any, any>, KyselyAlterTableBuilder>
>;
