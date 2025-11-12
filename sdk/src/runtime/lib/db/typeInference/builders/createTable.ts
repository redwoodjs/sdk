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
import {
  ColumnDescriptor,
  ExecutedBuilder,
  Prettify,
  SqlToTsType,
} from "../utils";
import { ColumnDefinitionBuilder } from "./columnDefinition";

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
        Record<K, ColumnDescriptor<SqlToTsType<T>, true, false, false>>
    >
  >;
  addColumn<
    K extends string,
    T extends string,
    TNullable extends boolean,
    THasDefault extends boolean = false,
    TIsAutoIncrement extends boolean = false,
  >(
    name: K,
    type: T,
    build: (
      col: ColumnDefinitionBuilder<SqlToTsType<T>>,
    ) => ColumnDefinitionBuilder<
      SqlToTsType<T>,
      TNullable,
      THasDefault,
      TIsAutoIncrement
    >,
  ): CreateTableBuilder<
    TName,
    Prettify<
      (TSchema extends Record<string, any> ? TSchema : {}) &
        Record<
          K,
          ColumnDescriptor<SqlToTsType<T>, TNullable, THasDefault, TIsAutoIncrement>
        >
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
