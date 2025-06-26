import { ExecutedBuilder } from "../utils";

export interface CreateViewBuilder<
  TName extends string,
  TSchema extends Record<string, any> = {},
> {
  readonly __viewName: TName;
  readonly __schema: TSchema;
  withSchema<S extends Record<string, any>>(): CreateViewBuilder<TName, S>;
  temporary(): this;
  orReplace(): this;
  ifNotExists(): this;
  columns(columns: string[]): this;
  as(query: any): this;
  execute(): ExecutedBuilder<this>;
}
