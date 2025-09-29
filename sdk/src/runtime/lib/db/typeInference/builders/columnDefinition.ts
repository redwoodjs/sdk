import {
  ColumnDefinitionNode,
  Expression,
  ColumnDefinitionBuilder as KyselyColumnDefinitionBuilder,
  sql,
} from "kysely";
import type { Assert, AssertStillImplements } from "../assert";

// This is not exported from Kysely, so we have to define it ourselves
// based on the Kysely source code.
type DefaultValueExpression = string | number | boolean | null | typeof sql;

export interface ColumnDefinitionBuilder<TType> {
  autoIncrement(): ColumnDefinitionBuilder<TType>;
  identity(): ColumnDefinitionBuilder<TType>;
  primaryKey(): ColumnDefinitionBuilder<TType>;
  references(ref: string): ColumnDefinitionBuilder<TType>;
  onDelete(
    onDelete: "no action" | "restrict" | "cascade" | "set null" | "set default",
  ): ColumnDefinitionBuilder<TType>;
  onUpdate(
    onUpdate: "no action" | "restrict" | "cascade" | "set null" | "set default",
  ): ColumnDefinitionBuilder<TType>;
  unique(): ColumnDefinitionBuilder<TType>;
  notNull(): ColumnDefinitionBuilder<TType>;
  unsigned(): ColumnDefinitionBuilder<TType>;
  defaultTo(value: DefaultValueExpression): ColumnDefinitionBuilder<TType>;
  check(expression: Expression<any>): ColumnDefinitionBuilder<TType>;
  generatedAlwaysAs(
    expression: Expression<any>,
  ): ColumnDefinitionBuilder<TType>;
  generatedAlwaysAsIdentity(): ColumnDefinitionBuilder<TType>;
  generatedByDefaultAsIdentity(): ColumnDefinitionBuilder<TType>;
  stored(): ColumnDefinitionBuilder<TType>;
  modifyFront(modifier: Expression<any>): ColumnDefinitionBuilder<TType>;
  nullsNotDistinct(): ColumnDefinitionBuilder<TType>;
  ifNotExists(): ColumnDefinitionBuilder<TType>;
  modifyEnd(modifier: Expression<any>): ColumnDefinitionBuilder<TType>;
  $call<T>(func: (qb: this) => T): T;
  toOperationNode(): ColumnDefinitionNode;
}

type _Assert = Assert<
  AssertStillImplements<
    ColumnDefinitionBuilder<any>,
    KyselyColumnDefinitionBuilder
  >
>;
