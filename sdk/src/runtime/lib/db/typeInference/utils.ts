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

type DroppedKeys<Altered> = {
  [K in keyof Altered]: Altered[K] extends never ? K : never;
}[keyof Altered];

type RenamedFromKeys<Altered> = {
  [K in keyof Altered]: Altered[K] extends { __renamed: infer From }
    ? From
    : never;
}[keyof Altered] &
  string;

type KeysToOmit<Altered> = DroppedKeys<Altered> | RenamedFromKeys<Altered>;

type RenamedKeys<Altered> = {
  [K in keyof Altered]: Altered[K] extends { __renamed: string } ? K : never;
}[keyof Altered];

type AddedColumns<Altered> = Omit<
  Altered,
  RenamedKeys<Altered> | DroppedKeys<Altered>
>;

type NewColumnsFromRenames<Original, Altered> = {
  [K in RenamedKeys<Altered> & keyof Altered]: Altered[K] extends {
    __renamed: infer From extends keyof Original;
  }
    ? Original[From]
    : never;
};

export type MergeAlteredTable<Original, Altered> = Prettify<
  Omit<Original, KeysToOmit<Altered>> &
    AddedColumns<Altered> &
    NewColumnsFromRenames<Original, Altered>
>;
