import {
  CompiledQuery,
  DropTableNode,
  DropTableBuilder as KyselyDropTableBuilder,
} from "kysely";
import type { Assert, AssertStillImplements } from "../assert";
import { ExecutedBuilder } from "../utils";

export interface DropTableBuilder<TName extends string> {
  readonly __tableName: TName;
  ifExists(): DropTableBuilder<TName>;
  cascade(): DropTableBuilder<TName>;
  execute(): Promise<ExecutedBuilder<this>>;
  toOperationNode(): DropTableNode;
  compile(): CompiledQuery;
  $call<T>(func: (qb: this) => T): T;
}

type _Assert = Assert<
  AssertStillImplements<DropTableBuilder<any>, KyselyDropTableBuilder>
>;
