import {
  ColumnDefinitionNode,
  Expression,
  ColumnDefinitionBuilder as KyselyColumnDefinitionBuilder,
  sql,
} from "kysely";
import type { Assert, AssertStillImplements } from "../assert";

// This is not exported from Kysely, so we have to define it ourselves
// based on the Kysely source code.
type DefaultValueExpression =
  | string
  | number
  | boolean
  | null
  | ReturnType<typeof sql>;

export type ColumnDescriptor = {
  tsType: any;
  isNullable: boolean;
  hasDefault: boolean;
  isAutoIncrement: boolean;
};

export interface ColumnDefinitionBuilder<
  TDescriptor extends ColumnDescriptor,
> {
  autoIncrement(): ColumnDefinitionBuilder<{
    [K in keyof TDescriptor]: K extends "isAutoIncrement" ? true : TDescriptor[K];
  }>;
  identity(): ColumnDefinitionBuilder<TDescriptor>;
  primaryKey(): ColumnDefinitionBuilder<{
    [K in keyof TDescriptor]: K extends "isNullable" ? false : TDescriptor[K];
  }>;
  references(ref: string): ColumnDefinitionBuilder<TDescriptor>;
  onDelete(
    onDelete: "no action" | "restrict" | "cascade" | "set null" | "set default",
  ): ColumnDefinitionBuilder<TDescriptor>;
  onUpdate(
    onUpdate: "no action" | "restrict" | "cascade" | "set null" | "set default",
  ): ColumnDefinitionBuilder<TDescriptor>;
  unique(): ColumnDefinitionBuilder<TDescriptor>;
  notNull(): ColumnDefinitionBuilder<{
    [K in keyof TDescriptor]: K extends "isNullable" ? false : TDescriptor[K];
  }>;
  unsigned(): ColumnDefinitionBuilder<TDescriptor>;
  defaultTo(
    value: DefaultValueExpression,
  ): ColumnDefinitionBuilder<{
    [K in keyof TDescriptor]: K extends "isNullable"
      ? false
      : K extends "hasDefault"
        ? true
        : TDescriptor[K];
  }>;
  check(expression: Expression<any>): ColumnDefinitionBuilder<TDescriptor>;
  generatedAlwaysAs(
    expression: Expression<any>,
  ): ColumnDefinitionBuilder<TDescriptor>;
  generatedAlwaysAsIdentity(): ColumnDefinitionBuilder<TDescriptor>;
  generatedByDefaultAsIdentity(): ColumnDefinitionBuilder<TDescriptor>;
  stored(): ColumnDefinitionBuilder<TDescriptor>;
  modifyFront(
    modifier: Expression<any>,
  ): ColumnDefinitionBuilder<TDescriptor>;
  nullsNotDistinct(): ColumnDefinitionBuilder<TDescriptor>;
  ifNotExists(): ColumnDefinitionBuilder<TDescriptor>;
  modifyEnd(
    modifier: Expression<any>,
  ): ColumnDefinitionBuilder<TDescriptor>;
  $call<T>(func: (qb: this) => T): T;
  toOperationNode(): ColumnDefinitionNode;
}

type _Assert = Assert<
  AssertStillImplements<
    ColumnDefinitionBuilder<any>,
    KyselyColumnDefinitionBuilder
  >
>;
