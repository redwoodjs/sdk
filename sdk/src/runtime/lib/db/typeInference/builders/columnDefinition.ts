import { ColumnDefinitionBuilder as KyselyColumnDefinitionBuilder } from "kysely";
import type { Assert, AssertStillImplements } from "../assert";

export interface ColumnDefinitionBuilder<T = any> {
  primaryKey(): ColumnDefinitionBuilder<T>;
  unique(): ColumnDefinitionBuilder<T>;
  notNull(): ColumnDefinitionBuilder<T>;
  unsigned(): ColumnDefinitionBuilder<T>;
  defaultTo(value: any): ColumnDefinitionBuilder<T>;
  references(ref: string): ColumnDefinitionBuilder<T>;
  onDelete(
    action: "cascade" | "restrict" | "set null" | "no action" | "set default",
  ): ColumnDefinitionBuilder<T>;
  onUpdate(
    action: "cascade" | "restrict" | "set null" | "no action" | "set default",
  ): ColumnDefinitionBuilder<T>;
  check(expression: any): ColumnDefinitionBuilder<T>;
  generatedAlwaysAs(expression: any): ColumnDefinitionBuilder<T>;
  generatedAlwaysAsIdentity(options?: any): ColumnDefinitionBuilder<T>;
  storedAs(expression: any): ColumnDefinitionBuilder<T>;
  $call<T>(func: (qb: this) => T): T;
  toOperationNode(): any;
}

type _Assert = Assert<
  AssertStillImplements<
    ColumnDefinitionBuilder<any>,
    KyselyColumnDefinitionBuilder
  >
>;
