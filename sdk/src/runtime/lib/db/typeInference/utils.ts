import { sql } from "kysely";

// --- AST Node Types for Alterations ---
// These will be consumed by ProcessAlteredTable to calculate the final schema.
type DataTypeExpression = string | typeof sql;
export type AddColumnOp<
  K extends string,
  T extends DataTypeExpression,
  TNullable extends boolean = true
> = {
  op: "addColumn";
  name: K;
  type: T;
  nullable: TNullable;
};
export type DropColumnOp<K extends string> = { op: "dropColumn"; name: K };
export type RenameColumnOp<KFrom extends string, KTo extends string> = {
  op: "renameColumn";
  from: KFrom;
  to: KTo;
};
export type ModifyColumnOp<
  K extends string,
  T extends DataTypeExpression,
  TNullable extends boolean = true
> = {
  op: "modifyColumn";
  name: K;
  type: T;
  nullable: TNullable;
};
// This is not exhaustive yet.
export type Alteration =
  | { kind: "setDataType"; dataType: string }
  | { kind: "setDefault"; value: any }
  | { kind: "dropDefault" }
  | { kind: "setNotNull" }
  | { kind: "dropNotNull" };

export type AlterColumnOp<K extends string, TAlteration extends Alteration> = {
  op: "alterColumn";
  name: K;
  alteration: TAlteration;
};

export type AlterOperation =
  | AddColumnOp<any, any, any>
  | DropColumnOp<any>
  | RenameColumnOp<any, any>
  | AlterColumnOp<any, any>
  | ModifyColumnOp<any, any, any>;
// --- End AST Node Types ---

export type SqlToTsType<T extends string | typeof sql> = T extends "text"
  ? string
  : T extends "integer"
    ? number
    : T extends "blob"
      ? Uint8Array
      : T extends "real"
        ? number
        : T extends "boolean"
          ? boolean
          : T extends typeof sql
            ? any
            : never;

export type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};

export type ExecutedBuilder<T> = { __builder_type: T };

export type MergeSchemas<A, B> = Prettify<Omit<A, keyof B> & B>;

export type OmitNever<T> = {
  [K in keyof T as T[K] extends never ? never : K]: T[K];
};

export type UnionToIntersection<U> = (
  U extends any ? (k: U) => void : never
) extends (k: infer I) => void
  ? I
  : never;

export type DeepClean<T> = T extends Uint8Array
  ? T
  : T extends Record<string, any>
    ? {
        [K in keyof T as T[K] extends never ? never : K]: DeepClean<T[K]>;
      } & {}
    : T;

export type Cast<A, B> = A extends B ? A : B;

/**
 * Applies a single alteration operation to a schema.
 */
type ApplyOp<TSchema, THeadOp> =
  THeadOp extends AddColumnOp<infer K, infer T, infer TNullable>
    ? Prettify<
        TSchema & {
          [P in K]: TNullable extends true
            ? SqlToTsType<T> | null
            : SqlToTsType<T>;
        }
      >
    : THeadOp extends DropColumnOp<infer K>
      ? Omit<TSchema, K>
      : THeadOp extends RenameColumnOp<infer KFrom, infer KTo>
        ? KFrom extends keyof TSchema
          ? Prettify<Omit<TSchema, KFrom> & { [P in KTo]: TSchema[KFrom] }>
          : TSchema // If KFrom is not in TSchema, do nothing.
        : THeadOp extends AlterColumnOp<infer K, infer TAlt>
          ? TAlt extends {
              kind: "setDataType";
              dataType: infer DT extends string;
            }
            ? Prettify<Omit<TSchema, K> & { [P in K]: SqlToTsType<DT> }>
            : TSchema // For other alterations (e.g., setDefault), the TS type doesn't change.
          : THeadOp extends ModifyColumnOp<infer K, infer T, infer TNullable>
            ? Prettify<
                Omit<TSchema, K> & {
                  [P in K]: TNullable extends true
                    ? SqlToTsType<T> | null
                    : SqlToTsType<T>;
                }
              >
            : TSchema;

/**
 * Recursively processes a list of alteration operations (AST)
 * to transform an initial schema into the final schema.
 */
export type ProcessAlteredTable<TInitialSchema, TOps> = TOps extends [
  infer THeadOp,
  ...infer TRestOps,
]
  ? ProcessAlteredTable<ApplyOp<TInitialSchema, THeadOp>, TRestOps>
  : TInitialSchema;

// --- Union to Tuple Helpers ---
// These are used to convert a union of types into a tuple, which allows for iteration.
type LastOf<U> =
  UnionToIntersection<U extends any ? () => U : never> extends () => infer R
    ? R
    : never;

export type UnionToTuple<U, Last = LastOf<U>> = [U] extends [never]
  ? []
  : [...UnionToTuple<Exclude<U, Last>>, Last];
// --- End Union to Tuple Helpers ---
