export interface ColumnDefinitionBuilder<T = any> {
  primaryKey(): ColumnDefinitionBuilder<T>;
  notNull(): ColumnDefinitionBuilder<T>;
  unique(): ColumnDefinitionBuilder<T>;
  defaultTo<V extends T>(value: V): ColumnDefinitionBuilder<T>;
  references(ref: string): ColumnDefinitionBuilder<T>;
  onDelete(
    action: "cascade" | "restrict" | "set null",
  ): ColumnDefinitionBuilder<T>;
  unsigned(): ColumnDefinitionBuilder<T>;
}
