import {
  CompiledQuery,
  CreateViewNode,
  CreateViewBuilder as KyselyCreateViewBuilder,
  RawBuilder,
  SelectQueryBuilder,
} from "kysely";
import type { Assert, AssertStillImplements } from "../assert";
import { ExecutedBuilder } from "../utils";

export interface CreateViewBuilder<
  TName extends string,
  TSchema extends Record<string, any> = {},
  TColumns extends string[] = [],
> {
  readonly __viewName: TName;
  readonly __schema: TSchema;
  readonly __columns: TColumns;
  temporary(): CreateViewBuilder<TName, TSchema, TColumns>;
  orReplace(): CreateViewBuilder<TName, TSchema, TColumns>;
  ifNotExists(): CreateViewBuilder<TName, TSchema, TColumns>;
  columns<C extends string[]>(columns: C): CreateViewBuilder<TName, TSchema, C>;
  as(
    query: SelectQueryBuilder<any, any, any> | RawBuilder<any>,
  ): CreateViewBuilder<TName, TSchema, TColumns>;
  execute(): Promise<ExecutedBuilder<this>>;
  toOperationNode(): CreateViewNode;
  compile(): CompiledQuery;
  $call<T>(func: (qb: this) => T): T;
  materialized(): CreateViewBuilder<TName, TSchema, TColumns>;
}

type _Assert = Assert<
  AssertStillImplements<
    CreateViewBuilder<any, any, any>,
    KyselyCreateViewBuilder
  >
>;
