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

export type MergeSchemas<A, B> = {
  [K in keyof A | keyof B]: K extends keyof A
    ? K extends keyof B
      ? Prettify<A[K] & B[K]>
      : A[K]
    : K extends keyof B
      ? B[K]
      : never;
};

export type OmitNever<T> = {
  [K in keyof T as T[K] extends never ? never : K]: T[K];
};

export type UnionToIntersection<U> = (
  U extends any ? (k: U) => void : never
) extends (k: infer I) => void
  ? I
  : never;

export type RemoveNeverValues<T> = {
  [K in keyof T as T[K] extends never ? never : K]: T[K];
};

type KeysToOmit<Altered> = {
  [K in keyof Altered]: Altered[K] extends never ? K : never;
}[keyof Altered];

type RenamedKeys<Altered> = {
  [K in keyof Altered]: Altered[K] extends { __renamed: any } ? K : never;
}[keyof Altered] &
  PropertyKey;

type RenamedSourceKeys<Altered> = {
  [K in keyof Altered]: Altered[K] extends { __renamed: infer From }
    ? From
    : never;
}[keyof Altered] &
  PropertyKey;

export type MergeAlteredTable<Original, Altered> = Prettify<
  // Pick the renamed columns from Altered, and assign them the type from Original
  {
    [K in RenamedKeys<Altered>]: Altered[K] extends { __renamed: infer From }
      ? From extends keyof Original
        ? Original[From]
        : any
      : never;
  } & Omit<Altered, KeysToOmit<Altered> | RenamedKeys<Altered>> & // Pick the columns from Altered that are not never or renamed
    // Pick the columns from Original that are not omitted or renamed
    Omit<Original, KeysToOmit<Altered> | RenamedSourceKeys<Altered>>
>;
