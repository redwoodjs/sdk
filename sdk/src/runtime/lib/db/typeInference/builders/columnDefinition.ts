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

export interface ColumnDefinitionBuilder<
  TType,
  TNullable extends boolean = true,
> {
  autoIncrement(): ColumnDefinitionBuilder<TType, TNullable>;
  identity(): ColumnDefinitionBuilder<TType, TNullable>;
  primaryKey(): ColumnDefinitionBuilder<TType, false>;
  references(ref: string): ColumnDefinitionBuilder<TType, TNullable>;
  onDelete(
    onDelete: "no action" | "restrict" | "cascade" | "set null" | "set default",
  ): ColumnDefinitionBuilder<TType, TNullable>;
  onUpdate(
    onUpdate: "no action" | "restrict" | "cascade" | "set null" | "set default",
  ): ColumnDefinitionBuilder<TType, TNullable>;
  unique(): ColumnDefinitionBuilder<TType, TNullable>;
  notNull(): ColumnDefinitionBuilder<TType, false>;
  unsigned(): ColumnDefinitionBuilder<TType, TNullable>;
  defaultTo(
    value: DefaultValueExpression,
  ): ColumnDefinitionBuilder<TType, false>;
  check(expression: Expression<any>): ColumnDefinitionBuilder<TType, TNullable>;
  generatedAlwaysAs(
    expression: Expression<any>,
  ): ColumnDefinitionBuilder<TType, TNullable>;
  generatedAlwaysAsIdentity(): ColumnDefinitionBuilder<TType, TNullable>;
  generatedByDefaultAsIdentity(): ColumnDefinitionBuilder<TType, TNullable>;
  stored(): ColumnDefinitionBuilder<TType, TNullable>;
  modifyFront(
    modifier: Expression<any>,
  ): ColumnDefinitionBuilder<TType, TNullable>;
  nullsNotDistinct(): ColumnDefinitionBuilder<TType, TNullable>;
  ifNotExists(): ColumnDefinitionBuilder<TType, TNullable>;
  modifyEnd(
    modifier: Expression<any>,
  ): ColumnDefinitionBuilder<TType, TNullable>;
  $call<T>(func: (qb: this) => T): T;
  toOperationNode(): ColumnDefinitionNode;
}

type _Assert = Assert<
  AssertStillImplements<
    ColumnDefinitionBuilder<any, any>,
    KyselyColumnDefinitionBuilder
  >
>;
