import { SqlToTsType, ExecutedBuilder, Prettify } from "../utils";
import { CreateColumnBuilder } from "./createColumn";

export interface AlterTableBuilder<
  TName extends string,
  TSchema extends Record<string, any> = {},
> {
  readonly __tableName: TName;
  readonly __addedColumns: TSchema;
  addColumn<K extends string, T extends string>(
    name: K,
    type: T,
    build?: (
      col: CreateColumnBuilder<SqlToTsType<T>>,
    ) => CreateColumnBuilder<SqlToTsType<T>>,
  ): AlterTableBuilder<TName, Prettify<TSchema & Record<K, SqlToTsType<T>>>>;
  dropColumn<K extends string>(
    name: K,
  ): AlterTableBuilder<TName, Prettify<TSchema & { [P in K]: never }>>;
  renameColumn<KFrom extends string, KTo extends string>(
    from: KFrom,
    to: KTo,
  ): AlterTableBuilder<
    TName,
    Prettify<TSchema & { [P in KFrom]: never } & { [P in KTo]: any }>
  >;
  execute(): ExecutedBuilder<this>;
}
