import { ExecutedBuilder } from "../utils";
import {
  DropViewBuilder as KyselyDropViewBuilder,
  DropViewNode,
  CompiledQuery,
} from "kysely";
import type { Assert, AssertStillImplements } from "../assert";

export interface DropViewBuilder<TName extends string> {
  readonly __viewName: TName;
  ifExists(): DropViewBuilder<TName>;
  cascade(): DropViewBuilder<TName>;
  execute(): Promise<ExecutedBuilder<this>>;
  toOperationNode(): DropViewNode;
  compile(): CompiledQuery;
  $call<T>(func: (qb: this) => T): T;
  materialized(): DropViewBuilder<TName>;
  withSchema(schema: string): DropViewBuilder<TName>;
}

type _Assert = Assert<
  AssertStillImplements<DropViewBuilder<any>, KyselyDropViewBuilder>
>;
