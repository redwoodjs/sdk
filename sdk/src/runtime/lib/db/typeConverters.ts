export interface TypeConverter<T = any> {
  /**
   * Parse a value from the database.
   * @param value The raw value from the database (string, number, or null).
   * @param columnName The name of the column being parsed.
   */
  parse?: (value: any, columnName?: string) => T | null;

  /**
   * Serialize a value to the database.
   * @param value The value to serialize.
   */
  serialize?: (value: T | null) => any;

  /**
   * Optional function to check if this converter should be applied to a column during parsing.
   * If not provided, the converter is applied if the key matches the column name.
   */
  match?: (columnName: string) => boolean;
}

export type TypeConverters = Record<string, TypeConverter>;
