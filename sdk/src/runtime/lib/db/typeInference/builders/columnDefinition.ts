import {
  ColumnDefinitionBuilder as KyselyColumnDefinitionBuilder,
  Expression,
  sql,
  ColumnDefinitionNode,
} from "kysely";
import type { Assert, AssertStillImplements } from "../assert";

// This is not exported from Kysely, so we have to define it ourselves
// based on the Kysely source code.
type DefaultValueExpression = string | number | boolean | null | typeof sql;

export interface ColumnDefinitionBuilder {
  autoIncrement(): ColumnDefinitionBuilder;
  identity(): ColumnDefinitionBuilder;
  primaryKey(): ColumnDefinitionBuilder;
  references(ref: string): ColumnDefinitionBuilder;
  onDelete(
    onDelete: "no action" | "restrict" | "cascade" | "set null" | "set default",
  ): ColumnDefinitionBuilder;
  onUpdate(
    onUpdate: "no action" | "restrict" | "cascade" | "set null" | "set default",
  ): ColumnDefinitionBuilder;
  unique(): ColumnDefinitionBuilder;
  notNull(): ColumnDefinitionBuilder;
  unsigned(): ColumnDefinitionBuilder;
  defaultTo(value: DefaultValueExpression): ColumnDefinitionBuilder;
  check(expression: Expression<any>): ColumnDefinitionBuilder;
  generatedAlwaysAs(expression: Expression<any>): ColumnDefinitionBuilder;
  generatedAlwaysAsIdentity(): ColumnDefinitionBuilder;
  generatedByDefaultAsIdentity(): ColumnDefinitionBuilder;
  stored(): ColumnDefinitionBuilder;
  modifyFront(modifier: Expression<any>): ColumnDefinitionBuilder;
  nullsNotDistinct(): ColumnDefinitionBuilder;
  ifNotExists(): ColumnDefinitionBuilder;
  modifyEnd(modifier: Expression<any>): ColumnDefinitionBuilder;
  $call<T>(func: (qb: this) => T): T;
  toOperationNode(): ColumnDefinitionNode;
}

type _Assert = Assert<
  AssertStillImplements<ColumnDefinitionBuilder, KyselyColumnDefinitionBuilder>
>;
