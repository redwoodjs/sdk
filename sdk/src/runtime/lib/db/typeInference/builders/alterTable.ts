import {
  SqlToTsType,
  ExecutedBuilder,
  AlterOperation,
  AddColumnOp,
  DropColumnOp,
  RenameColumnOp,
  AlterColumnOp,
  ModifyColumnOp,
} from "../utils";
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

type AlterColumnResult<
  TSchema,
  K extends string,
  TAlteration,
> = TAlteration extends { kind: "setDataType" }
  ? Omit<TSchema, K> & MapAlterationToSchema<K, TAlteration>
  : TSchema;

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
  TOps extends AlterOperation[] = [],
> {
  readonly __tableName: TName;
  readonly __operations: TOps;
  renameTo<TNewName extends string>(
    newTableName: TNewName,
  ): AlterTableBuilder<TNewName, TOps> & { readonly __renamedFrom: TName };
  setSchema(newSchema: string): AlterTableBuilder<TName, TOps>;
  addColumn<K extends string, T extends DataTypeExpression>(
    name: K,
    type: T,
    build?: (
      col: ColumnDefinitionBuilder<SqlToTsType<T>>,
    ) => ColumnDefinitionBuilder<SqlToTsType<T>>,
  ): AlterTableBuilder<TName, [...TOps, AddColumnOp<K, T>]>;
  dropColumn<K extends string>(
    name: K,
  ): AlterTableBuilder<TName, [...TOps, DropColumnOp<K>]>;
  renameColumn<KFrom extends string, KTo extends string>(
    from: KFrom,
    to: KTo,
  ): AlterTableBuilder<TName, [...TOps, RenameColumnOp<KFrom, KTo>]>;
  alterColumn<
    K extends string,
    const TCallback extends AlterColumnBuilderCallback,
  >(
    column: K,
    alteration: TCallback,
  ): AlterTableBuilder<
    TName,
    [...TOps, AlterColumnOp<K, ReturnType<TCallback>["__alteration"]>]
  >;
  modifyColumn<K extends string, T extends DataTypeExpression>(
    column: K,
    type: T,
    build?: (
      col: ColumnDefinitionBuilder<SqlToTsType<T>>,
    ) => ColumnDefinitionBuilder<SqlToTsType<T>>,
  ): AlterTableBuilder<TName, [...TOps, ModifyColumnOp<K, T>]>;
  addUniqueConstraint(
    constraintName: string,
    columns: string[],
    build?: (builder: UniqueConstraintBuilder) => UniqueConstraintBuilder,
  ): AlterTableBuilder<TName, TOps>;
  addPrimaryKeyConstraint(
    constraintName: string,
    columns: string[],
    build?: (
      builder: PrimaryKeyConstraintBuilder,
    ) => PrimaryKeyConstraintBuilder,
  ): AlterTableBuilder<TName, TOps>;
  addCheckConstraint(
    constraintName: string,
    checkExpression: Expression<any>,
    build?: (builder: CheckConstraintBuilder) => CheckConstraintBuilder,
  ): AlterTableBuilder<TName, TOps>;
  addForeignKeyConstraint(
    constraintName: string,
    columns: string[],
    targetTable: string,
    targetColumns: string[],
    build?: (
      builder: ForeignKeyConstraintBuilder,
    ) => ForeignKeyConstraintBuilder,
  ): AlterTableBuilder<TName, TOps>;
  dropConstraint(constraintName: string): AlterTableBuilder<TName, TOps>;
  renameConstraint(
    oldName: string,
    newName: string,
  ): AlterTableBuilder<TName, TOps>;
  addIndex(indexName: string): AlterTableBuilder<TName, TOps>;
  dropIndex(indexName: string): AlterTableBuilder<TName, TOps>;
  execute(): Promise<ExecutedBuilder<this>>;
  $call<T>(func: (qb: this) => T): T;
}

type _Assert = Assert<
  AssertStillImplements<AlterTableBuilder<any, any>, KyselyAlterTableBuilder>
>;
