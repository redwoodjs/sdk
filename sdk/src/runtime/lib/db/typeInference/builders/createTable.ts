import {
  CheckConstraintNode,
  CompiledQuery,
  CreateTableNode,
  Expression,
  ForeignKeyConstraintBuilder,
  CreateTableBuilder as KyselyCreateTableBuilder,
  PrimaryKeyConstraintNode,
  UniqueConstraintNode,
} from "kysely";
import type { Assert, AssertStillImplements } from "../assert";
import { ExecutedBuilder, Prettify, SqlToTsType } from "../utils";
import {
  ColumnDefinitionBuilder,
  ColumnDescriptor,
} from "./columnDefinition";

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

type InitialDescriptor<TType> = {
  tsType: TType;
  isNullable: true;
  hasDefault: false;
  isAutoIncrement: false;
};

export interface CreateTableBuilder<
  TName extends string,
  TSchema extends Record<string, any> = {},
> {
  readonly __tableName: TName;
  readonly __addedColumns: TSchema;
  temporary(): CreateTableBuilder<TName, TSchema>;
  onCommit(
    onCommit: "preserve rows" | "delete rows" | "drop",
  ): CreateTableBuilder<TName, TSchema>;
  ifNotExists(): CreateTableBuilder<TName, TSchema>;
  addColumn<K extends string, T extends string>(
    name: K,
    type: T,
  ): CreateTableBuilder<
    TName,
    Prettify<
      (TSchema extends Record<string, any> ? TSchema : {}) &
        Record<K, InitialDescriptor<SqlToTsType<T>>>
    >
  >;
  addColumn<
    K extends string,
    T extends string,
    TDescriptor extends ColumnDescriptor,
  >(
    name: K,
    type: T,
    build: (
      col: ColumnDefinitionBuilder<InitialDescriptor<SqlToTsType<T>>>,
    ) => ColumnDefinitionBuilder<TDescriptor>,
  ): CreateTableBuilder<
    TName,
    Prettify<
      (TSchema extends Record<string, any> ? TSchema : {}) & Record<K, TDescriptor>
    >
  >;
  addUniqueConstraint(
    constraintName: string,
    columns: (keyof TSchema)[],
    build?: (builder: UniqueConstraintBuilder) => UniqueConstraintBuilder,
  ): CreateTableBuilder<TName, TSchema>;
  addPrimaryKeyConstraint(
    constraintName: string,
    columns: (keyof TSchema)[],
    build?: (
      builder: PrimaryKeyConstraintBuilder,
    ) => PrimaryKeyConstraintBuilder,
  ): CreateTableBuilder<TName, TSchema>;
  addCheckConstraint(
    constraintName: string,
    checkExpression: Expression<any>,
    build?: (builder: CheckConstraintBuilder) => CheckConstraintBuilder,
  ): CreateTableBuilder<TName, TSchema>;
  addForeignKeyConstraint(
    constraintName: string,
    columns: (keyof TSchema)[],
    targetTable: string,
    targetColumns: string[],
    build?: (
      builder: ForeignKeyConstraintBuilder,
    ) => ForeignKeyConstraintBuilder,
  ): CreateTableBuilder<TName, TSchema>;
  modifyFront(modifier: Expression<any>): CreateTableBuilder<TName, TSchema>;
  modifyEnd(modifier: Expression<any>): CreateTableBuilder<TName, TSchema>;
  as(expression: Expression<any>): CreateTableBuilder<TName, TSchema>;
  execute(): Promise<ExecutedBuilder<this>>;
  $call<T>(func: (qb: this) => T): T;
  compile(): CompiledQuery;
  toOperationNode(): CreateTableNode;
  withSchema(schema: string): CreateTableBuilder<TName, TSchema>;
  ownerTo(owner: string): CreateTableBuilder<TName, TSchema>;
  replace(): CreateTableBuilder<TName, TSchema>;
  ignore(): CreateTableBuilder<TName, TSchema>;
  withoutTableConstraintValidation(): CreateTableBuilder<TName, TSchema>;
}

type KyselyKeys = keyof KyselyCreateTableBuilder<any>;
type OurKeys = keyof CreateTableBuilder<any, any>;
type Missing = Exclude<KyselyKeys, OurKeys>;
type _Assert = Assert<
  AssertStillImplements<
    CreateTableBuilder<any, any>,
    KyselyCreateTableBuilder<any, any>
  >
>;
