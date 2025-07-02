import {
  AlterColumnBuilder as KyselyAlterColumnBuilder,
  sql,
  AlterColumnNode,
} from "kysely";
import type { Assert, AssertStillImplements } from "../assert";

// This is not exported from Kysely, so we have to define it ourselves
// based on the Kysely source code.
type DefaultValueExpression = string | number | boolean | null | typeof sql;
type DataTypeExpression = string | typeof sql;

export class AlterColumnBuilder {
  setDataType(dataType: DataTypeExpression): AlteredColumnBuilder {
    return new AlteredColumnBuilder({
      kind: "setDataType",
      dataType: dataType as string,
    });
  }
  setDefault(value: DefaultValueExpression): AlteredColumnBuilder {
    return new AlteredColumnBuilder({
      kind: "setDefault",
      value,
    });
  }
  dropDefault(): AlteredColumnBuilder {
    return new AlteredColumnBuilder({
      kind: "dropDefault",
    });
  }
  setNotNull(): AlteredColumnBuilder {
    return new AlteredColumnBuilder({
      kind: "setNotNull",
    });
  }
  dropNotNull(): AlteredColumnBuilder {
    return new AlteredColumnBuilder({
      kind: "dropNotNull",
    });
  }
  $call<T>(func: (qb: this) => T): T {
    return func(this);
  }
}

export class AlteredColumnBuilder {
  readonly #alteredColumn: AlteredColumn;

  constructor(alteredColumn: AlteredColumn) {
    this.#alteredColumn = alteredColumn;
  }

  toOperationNode(): AlterColumnNode {
    // This is not actually correct, but it's the best we can do
    // with the current structure.
    return this.#alteredColumn as any;
  }
}

export type AlteredColumn =
  | { kind: "setDataType"; dataType: string }
  | { kind: "setDefault"; value: DefaultValueExpression }
  | { kind: "dropDefault" }
  | { kind: "setNotNull" }
  | { kind: "dropNotNull" };

export type AlterColumnBuilderCallback = (
  builder: AlterColumnBuilder,
) => AlteredColumnBuilder;

type _Assert = Assert<
  AssertStillImplements<AlterColumnBuilder, KyselyAlterColumnBuilder>
>;
