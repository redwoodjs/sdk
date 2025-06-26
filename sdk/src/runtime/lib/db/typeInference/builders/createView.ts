import { ExecutedBuilder } from "../utils";

export interface CreateViewBuilder<
  TName extends string,
  TSchema extends Record<string, any> = {},
> {
  readonly __viewName: TName;
  readonly __schema: TSchema;
  withSchema<S extends Record<string, any>>(): CreateViewBuilder<TName, S>;
  temporary(): CreateViewBuilder<TName>;
  orReplace(): CreateViewBuilder<TName>;
  ifNotExists(): CreateViewBuilder<TName>;
  columns(columns: string[]): CreateViewBuilder<TName>;
  as(expression: string): CreateViewBuilder<TName>;
  execute(): ExecutedBuilder<this>;
}
