import { AlterColumnBuilder as KyselyAlterColumnBuilder } from "kysely";
import type { Assert, AssertStillImplements } from "../assert";

export type AlteredColumn =
  | { kind: "setDataType"; dataType: string }
  | { kind: "setDefault"; value: any }
  | { kind: "dropDefault" }
  | { kind: "setNotNull" }
  | { kind: "dropNotNull" };

export interface AlterColumnBuilder {
  setDataType<T extends string>(dataType: T): AlteredColumn;
  setDefault(value: any): AlteredColumn;
  dropDefault(): AlteredColumn;
  setNotNull(): AlteredColumn;
  dropNotNull(): AlteredColumn;
}

export type AlterColumnBuilderCallback = (
  builder: AlterColumnBuilder,
) => AlteredColumn;

/*
type _Assert = Assert<
  AssertStillImplements<AlterColumnBuilder, KyselyAlterColumnBuilder>
>;
*/
