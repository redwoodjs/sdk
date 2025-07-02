import { ExecutedBuilder } from "../utils";
import { DropTableBuilder as KyselyDropTableBuilder } from "kysely";
import type { Assert, AssertStillImplements } from "../assert";

export interface DropTableBuilder<TName extends string> {
  readonly __tableName: TName;
  ifExists(): DropTableBuilder<TName>;
  cascade(): DropTableBuilder<TName>;
  execute(): Promise<ExecutedBuilder<this>>;
  toOperationNode(): any;
  compile(): any;
  $call<T>(func: (qb: this) => T): T;
}

type _Assert = Assert<
  AssertStillImplements<DropTableBuilder<any>, KyselyDropTableBuilder>
>;
