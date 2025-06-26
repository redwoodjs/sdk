export interface ColumnBuilder<T = any> {
  primaryKey(): ColumnBuilder<T>;
  notNull(): ColumnBuilder<T>;
  unique(): ColumnBuilder<T>;
  defaultTo<V extends T>(value: V): ColumnBuilder<T>;
  references(ref: string): ColumnBuilder<T>;
  onDelete(action: "cascade" | "restrict" | "set null"): ColumnBuilder<T>;
  unsigned(): ColumnBuilder<T>;
}
