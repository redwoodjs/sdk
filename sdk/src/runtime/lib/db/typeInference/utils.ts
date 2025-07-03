import { sql } from "kysely";

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

type ProcessTable<T> = Prettify<{
  [K in keyof T as T[K] extends never
    ? never
    : K extends {
          [P in keyof T]: T[P] extends { __renamed: infer From } ? From : never;
        }[keyof T]
      ? never
      : K]: T[K] extends { __renamed: infer From extends keyof T }
    ? T[From]
    : T[K];
}>;

export type FinalizeSchema<T> =
  T extends Record<string, any>
    ? {
        [TableName in keyof T]: ProcessTable<T[TableName]>;
      }
    : T;
