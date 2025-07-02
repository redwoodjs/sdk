import { SqlToTsType, ExecutedBuilder, Prettify } from "../utils";
import { ColumnDefinitionBuilder } from "./columnDefinition";
import { CreateTableBuilder as KyselyCreateTableBuilder } from "kysely";
import type { Assert, AssertStillImplements } from "../assert";

export interface TableBuilder<
  TName extends string,
  TSchema extends Record<string, any> = {},
> {
  readonly __tableName: TName;
  readonly __schema: TSchema;
  addColumn<K extends string, T extends string>(
    name: K,
    type: T,
    build?: (
      col: ColumnDefinitionBuilder<SqlToTsType<T>>,
    ) => ColumnDefinitionBuilder<SqlToTsType<T>>,
  ): TableBuilder<TName, Prettify<TSchema & Record<K, SqlToTsType<T>>>>;
  temporary(): this;
  ifNotExists(): this;
  execute(): Promise<ExecutedBuilder<this>>;
  toOperationNode(): any;
  compile(): any;
  $call<T>(func: (qb: this) => T): T;
  onCommit(action: any): this;
  addUniqueConstraint(constraintName: string, columns: any[]): this;
  addPrimaryKeyConstraint(constraintName: string, columns: any[]): this;
  addCheckConstraint(constraintName: string, checkExpression: any): this;
  addForeignKeyConstraint(
    constraintName: string,
    columns: any[],
    targetTable: string,
    targetColumns: any[],
  ): this;
  modifyFront(modifier: any): this;
  modifyEnd(modifier: any): this;
  as(expression: any): this;
  withSchema(schema: string): this;
  ownerTo(owner: string): this;
  replace(): this;
  ignore(): this;
  withoutTableConstraintValidation(): this;
}

type _Assert = Assert<
  AssertStillImplements<TableBuilder<any, any>, KyselyCreateTableBuilder<any>>
>;
