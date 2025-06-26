import { SqlToTsType, ExecutedBuilder, Prettify } from "../utils";
import { CreateColumnBuilder } from "./createColumn";

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
      col: CreateColumnBuilder<SqlToTsType<T>>,
    ) => CreateColumnBuilder<SqlToTsType<T>>,
  ): TableBuilder<TName, Prettify<TSchema & Record<K, SqlToTsType<T>>>>;
  temporary(): this;
  ifNotExists(): this;
  execute(): ExecutedBuilder<this>;
}
