import { ExecutedBuilder } from "../utils";

export interface CreateViewBuilder<
  TName extends string,
  TSchema extends Record<string, any> = {},
  TColumns extends string[] = [],
> {
  readonly __viewName: TName;
  readonly __schema: TSchema;
  readonly __columns: TColumns;
  withSchema<S extends Record<string, any>>(): CreateViewBuilder<
    TName,
    S,
    TColumns
  >;
  temporary(): CreateViewBuilder<TName, TSchema, TColumns>;
  orReplace(): CreateViewBuilder<TName, TSchema, TColumns>;
  ifNotExists(): CreateViewBuilder<TName, TSchema, TColumns>;
  columns<C extends string[]>(columns: C): CreateViewBuilder<TName, TSchema, C>;
  as<E extends string>(
    expression: E,
  ): CreateViewBuilder<TName, TSchema, TColumns>;
  execute(): ExecutedBuilder<this>;
}
