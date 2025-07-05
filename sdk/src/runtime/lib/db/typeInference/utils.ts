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

type RenamedFromKeys<Altered> = {
  [P in keyof Altered]: Altered[P] extends { __renamed: infer From }
    ? From
    : never;
}[keyof Altered];

type ProcessAlteredTable<
  Original,
  Altered,
  TRenamed = RenamedFromKeys<Altered>,
> = Prettify<
  Omit<
    Original,
    (TRenamed extends PropertyKey ? TRenamed : never) | keyof Altered
  > & {
    [K in keyof Altered]: Altered[K] extends {
      __renamed: infer From extends keyof Original;
    }
      ? Original[From]
      : Altered[K];
  }
>;

export type FinalizeSchema<TAll, TAltered> =
  TAll extends Record<string, any>
    ? {
        [TableName in keyof (TAll & TAltered)]: TableName extends keyof TAltered
          ? TableName extends keyof TAll
            ? ProcessAlteredTable<TAll[TableName], TAltered[TableName]>
            : TAltered[TableName]
          : TableName extends keyof TAll
            ? TAll[TableName]
            : never;
      }
    : TAll;
