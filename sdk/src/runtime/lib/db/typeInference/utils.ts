import { sql } from "kysely";
import { ColumnDescriptor } from "./builders/columnDefinition";

// --- AST Node Types for Alterations ---
// These will be consumed by ProcessAlteredTable to calculate the final schema.
type DataTypeExpression = string | typeof sql;
export type AddColumnOp<
  K extends string,
  T extends DataTypeExpression,
  TDescriptor extends ColumnDescriptor,
> = {
  op: "addColumn";
  name: K;
  type: T;
  descriptor: TDescriptor;
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
  TDescriptor extends ColumnDescriptor,
> = {
  op: "modifyColumn";
  name: K;
  type: T;
  descriptor: TDescriptor;
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
  THeadOp extends AddColumnOp<infer K, any, infer TDescriptor>
    ? Prettify<TSchema & { [P in K]: TDescriptor }>
    : THeadOp extends DropColumnOp<infer K>
      ? Omit<TSchema, K>
      : THeadOp extends RenameColumnOp<infer KFrom, infer KTo>
        ? KFrom extends keyof TSchema
          ? Prettify<Omit<TSchema, KFrom> & { [P in KTo]: TSchema[KFrom] }>
          : TSchema // If KFrom is not in TSchema, do nothing.
        : THeadOp extends AlterColumnOp<infer K, infer TAlt>
          ? K extends keyof TSchema
            ? TAlt extends { kind: "setDataType"; dataType: infer DT extends string }
              ? Prettify<
                  Omit<TSchema, K> & {
                    [P in K]: {
                      tsType: SqlToTsType<DT>;
                      isNullable: TSchema[K] extends { isNullable: infer N }
                        ? N
                        : true;
                      hasDefault: TSchema[K] extends { hasDefault: infer D }
                        ? D
                        : false;
                      isAutoIncrement: TSchema[K] extends {
                        isAutoIncrement: infer A;
                      }
                        ? A
                        : false;
                    };
                  }
                >
              : TAlt extends { kind: "setDefault" }
                ? Prettify<
                    Omit<TSchema, K> & {
                      [P in K]: TSchema[K] extends ColumnDescriptor
                        ? {
                            tsType: TSchema[K]["tsType"];
                            isNullable: false;
                            hasDefault: true;
                            isAutoIncrement: TSchema[K]["isAutoIncrement"];
                          }
                        : TSchema[K];
                    }
                  >
                : TAlt extends { kind: "dropDefault" }
                  ? Prettify<
                      Omit<TSchema, K> & {
                        [P in K]: TSchema[K] extends ColumnDescriptor
                          ? {
                              tsType: TSchema[K]["tsType"];
                              isNullable: TSchema[K]["isNullable"];
                              hasDefault: false;
                              isAutoIncrement: TSchema[K]["isAutoIncrement"];
                            }
                          : TSchema[K];
                      }
                    >
                  : TAlt extends { kind: "setNotNull" }
                    ? Prettify<
                        Omit<TSchema, K> & {
                          [P in K]: TSchema[K] extends ColumnDescriptor
                            ? {
                                tsType: TSchema[K]["tsType"];
                                isNullable: false;
                                hasDefault: TSchema[K]["hasDefault"];
                                isAutoIncrement: TSchema[K]["isAutoIncrement"];
                              }
                            : TSchema[K];
                        }
                      >
                    : TAlt extends { kind: "dropNotNull" }
                      ? Prettify<
                          Omit<TSchema, K> & {
                            [P in K]: TSchema[K] extends ColumnDescriptor
                              ? {
                                  tsType: TSchema[K]["tsType"];
                                  isNullable: true;
                                  hasDefault: TSchema[K]["hasDefault"];
                                  isAutoIncrement: TSchema[K]["isAutoIncrement"];
                                }
                              : TSchema[K];
                          }
                        >
                      : TSchema
            : TSchema
          : THeadOp extends ModifyColumnOp<infer K, any, infer TDescriptor>
            ? Prettify<Omit<TSchema, K> & { [P in K]: TDescriptor }>
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
