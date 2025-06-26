import { SqlToTsType, ExecutedBuilder, Prettify } from "../utils";
import { ColumnDefinitionBuilder } from "./columnDefinition";
import { AlterColumnBuilder, AlterColumnBuilderCallback } from "./alterColumn";

export interface AlterTableBuilder<
  TName extends string,
  TSchema extends Record<string, any> = {},
> {
  readonly __tableName: TName;
  readonly __addedColumns: TSchema;
  renameTo<TNewName extends string>(
    newTableName: TNewName,
  ): AlterTableBuilder<TNewName, TSchema>;
  setSchema(newSchema: string): AlterTableBuilder<TName, TSchema>;
  addColumn<K extends string, T extends string>(
    name: K,
    type: T,
    build?: (
      col: ColumnDefinitionBuilder<SqlToTsType<T>>,
    ) => ColumnDefinitionBuilder<SqlToTsType<T>>,
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
  alterColumn<K extends string>(
    column: K,
    alteration: AlterColumnBuilderCallback,
  ): AlterTableBuilder<TName, TSchema>;
  modifyColumn<K extends string, T extends string>(
    column: K,
    type: T,
    build?: (
      col: ColumnDefinitionBuilder<SqlToTsType<T>>,
    ) => ColumnDefinitionBuilder<SqlToTsType<T>>,
  ): AlterTableBuilder<TName, Prettify<TSchema & Record<K, SqlToTsType<T>>>>;
  execute(): ExecutedBuilder<this>;
}
