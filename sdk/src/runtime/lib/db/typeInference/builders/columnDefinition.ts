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
  THasDefault extends boolean = false,
  TIsAutoIncrement extends boolean = false,
> {
  autoIncrement(): ColumnDefinitionBuilder<TType, TNullable, THasDefault, true>;
  identity(): ColumnDefinitionBuilder<TType, TNullable, THasDefault, TIsAutoIncrement>;
  primaryKey(): ColumnDefinitionBuilder<TType, false, THasDefault, TIsAutoIncrement>;
  references(ref: string): ColumnDefinitionBuilder<TType, TNullable, THasDefault, TIsAutoIncrement>;
  onDelete(
    onDelete: "no action" | "restrict" | "cascade" | "set null" | "set default",
  ): ColumnDefinitionBuilder<TType, TNullable, THasDefault, TIsAutoIncrement>;
  onUpdate(
    onUpdate: "no action" | "restrict" | "cascade" | "set null" | "set default",
  ): ColumnDefinitionBuilder<TType, TNullable, THasDefault, TIsAutoIncrement>;
  unique(): ColumnDefinitionBuilder<TType, TNullable, THasDefault, TIsAutoIncrement>;
  notNull(): ColumnDefinitionBuilder<TType, false, THasDefault, TIsAutoIncrement>;
  unsigned(): ColumnDefinitionBuilder<TType, TNullable, THasDefault, TIsAutoIncrement>;
  defaultTo(
    value: DefaultValueExpression,
  ): ColumnDefinitionBuilder<TType, false, true, TIsAutoIncrement>;
  check(expression: Expression<any>): ColumnDefinitionBuilder<TType, TNullable, THasDefault, TIsAutoIncrement>;
  generatedAlwaysAs(
    expression: Expression<any>,
  ): ColumnDefinitionBuilder<TType, TNullable, THasDefault, TIsAutoIncrement>;
  generatedAlwaysAsIdentity(): ColumnDefinitionBuilder<TType, TNullable, THasDefault, TIsAutoIncrement>;
  generatedByDefaultAsIdentity(): ColumnDefinitionBuilder<TType, TNullable, THasDefault, TIsAutoIncrement>;
  stored(): ColumnDefinitionBuilder<TType, TNullable, THasDefault, TIsAutoIncrement>;
  modifyFront(
    modifier: Expression<any>,
  ): ColumnDefinitionBuilder<TType, TNullable, THasDefault, TIsAutoIncrement>;
  nullsNotDistinct(): ColumnDefinitionBuilder<TType, TNullable, THasDefault, TIsAutoIncrement>;
  ifNotExists(): ColumnDefinitionBuilder<TType, TNullable, THasDefault, TIsAutoIncrement>;
  modifyEnd(
    modifier: Expression<any>,
  ): ColumnDefinitionBuilder<TType, TNullable, THasDefault, TIsAutoIncrement>;
  $call<T>(func: (qb: this) => T): T;
  toOperationNode(): ColumnDefinitionNode;
}

type _Assert = Assert<
  AssertStillImplements<
    ColumnDefinitionBuilder<any, any>,
    KyselyColumnDefinitionBuilder
  >
>;
