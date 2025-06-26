import { SqlToTsType, ExecutedBuilder, Prettify } from "../utils";
import { ColumnDefinitionBuilder } from "./columnDefinition";

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
    build?: (
      col: ColumnDefinitionBuilder<SqlToTsType<T>>,
    ) => ColumnDefinitionBuilder<SqlToTsType<T>>,
  ): CreateTableBuilder<TName, Prettify<TSchema & Record<K, SqlToTsType<T>>>>;
  modifyFront(modifier: string): CreateTableBuilder<TName, TSchema>;
  modifyEnd(modifier: string): CreateTableBuilder<TName, TSchema>;
  as(expression: string): CreateTableBuilder<TName, TSchema>;
  execute(): ExecutedBuilder<this>;
}
