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
  setDataType<T extends DataTypeExpression>(
    dataType: T,
  ): AlteredColumnBuilder<{ kind: "setDataType"; dataType: T }> {
    return new AlteredColumnBuilder({
      kind: "setDataType",
      dataType: dataType as any,
    });
  }
  setDefault(value: DefaultValueExpression): AlteredColumnBuilder<{
    kind: "setDefault";
    value: DefaultValueExpression;
  }> {
    return new AlteredColumnBuilder({
      kind: "setDefault",
      value,
    });
  }
  dropDefault(): AlteredColumnBuilder<{ kind: "dropDefault" }> {
    return new AlteredColumnBuilder({
      kind: "dropDefault",
    });
  }
  setNotNull(): AlteredColumnBuilder<{ kind: "setNotNull" }> {
    return new AlteredColumnBuilder({
      kind: "setNotNull",
    });
  }
  dropNotNull(): AlteredColumnBuilder<{ kind: "dropNotNull" }> {
    return new AlteredColumnBuilder({
      kind: "dropNotNull",
    });
  }
  $call<T>(func: (qb: this) => T): T {
    return func(this);
  }
}

export class AlteredColumnBuilder<TAlteration extends AlteredColumn> {
  readonly __alteration: TAlteration;
  #alteredColumn: AlteredColumn;

  constructor(alteredColumn: AlteredColumn) {
    this.#alteredColumn = alteredColumn;
    this.__alteration = alteredColumn as TAlteration;
  }

  toOperationNode(): AlterColumnNode {
    // This is not actually correct, but it's the best we can do
    // with the current structure.
    return this.#alteredColumn as any;
  }
}

export type AlteredColumn =
  | { kind: "setDataType"; dataType: DataTypeExpression }
  | { kind: "setDefault"; value: DefaultValueExpression }
  | { kind: "dropDefault" }
  | { kind: "setNotNull" }
  | { kind: "dropNotNull" };

export type AlterColumnBuilderCallback = (
  builder: AlterColumnBuilder,
) => AlteredColumnBuilder<any>;

type _Assert = Assert<
  AssertStillImplements<AlterColumnBuilder, KyselyAlterColumnBuilder>
>;
