import { ExecutedBuilder } from "../utils";
import { CreateViewBuilder as KyselyCreateViewBuilder } from "kysely";
import type { Assert, AssertStillImplements } from "../assert";

export interface CreateViewBuilder<
  TName extends string,
  TSchema extends Record<string, any> = {},
  TColumns extends string[] = [],
> {
  readonly __viewName: TName;
  readonly __schema: TSchema;
  readonly __columns: TColumns;
  withSchema(schema: string): CreateViewBuilder<TName, TSchema, TColumns>;
  temporary(): CreateViewBuilder<TName, TSchema, TColumns>;
  orReplace(): CreateViewBuilder<TName, TSchema, TColumns>;
  ifNotExists(): CreateViewBuilder<TName, TSchema, TColumns>;
  columns<C extends string[]>(columns: C): CreateViewBuilder<TName, TSchema, C>;
  as<E extends string>(
    expression: E,
  ): CreateViewBuilder<TName, TSchema, TColumns>;
  execute(): Promise<ExecutedBuilder<this>>;
  toOperationNode(): any;
  compile(): any;
  $call<T>(func: (qb: this) => T): T;
  materialized(): CreateViewBuilder<TName, TSchema, TColumns>;
}

type _Assert = Assert<
  AssertStillImplements<
    CreateViewBuilder<any, any, any>,
    KyselyCreateViewBuilder
  >
>;
