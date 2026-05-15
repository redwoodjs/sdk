import {
  AlterColumnNode,
  AlterColumnBuilder as KyselyAlterColumnBuilder,
} from "kysely";
import type { Assert, AssertStillImplements } from "../assert";
import { Alteration } from "../utils";

export interface AlteredColumnBuilder<TAlteration extends Alteration> {
  readonly __alteration: TAlteration;
  toOperationNode(): AlterColumnNode;
}

export interface AlterColumnBuilder {
  setDataType<T extends string>(
    dataType: T,
  ): AlteredColumnBuilder<{ kind: "setDataType"; dataType: T }>;

  setDefault<T>(
    value: T,
  ): AlteredColumnBuilder<{ kind: "setDefault"; value: T }>;

  dropDefault(): AlteredColumnBuilder<{ kind: "dropDefault" }>;

  setNotNull(): AlteredColumnBuilder<{ kind: "setNotNull" }>;

  dropNotNull(): AlteredColumnBuilder<{ kind: "dropNotNull" }>;

  $call<T>(func: (qb: this) => T): T;
}

export type AlterColumnBuilderCallback = (
  builder: AlterColumnBuilder,
) => AlteredColumnBuilder<any>;

type _Assert = Assert<
  AssertStillImplements<AlterColumnBuilder, KyselyAlterColumnBuilder>
>;
