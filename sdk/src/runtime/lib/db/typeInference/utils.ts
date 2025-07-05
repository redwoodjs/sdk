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

type FindRenameTarget<TKey extends PropertyKey, TAltered> = keyof {
  [P in keyof TAltered as TAltered[P] extends { __renamed: TKey }
    ? P
    : never]: 1;
};

type FollowChain<
  TKey extends PropertyKey,
  TAltered,
  TSeen extends PropertyKey[] = [],
> = TKey extends TSeen[number]
  ? TKey
  : FindRenameTarget<TKey, TAltered> extends never
    ? TKey
    : FollowChain<
        Extract<FindRenameTarget<TKey, TAltered>, PropertyKey>,
        TAltered,
        [...TSeen, TKey]
      >;

type GetFinalSchema<TOriginal, TAltered> = {
  [K in keyof TOriginal as FollowChain<
    Extract<K, PropertyKey>,
    TAltered
  > extends infer FinalName extends PropertyKey
    ? FinalName extends keyof TAltered
      ? TAltered[FinalName] extends { __dropped: true }
        ? never
        : FinalName
      : FinalName
    : never]: TOriginal[K];
};

type AddedColumns<TOriginal, TAltered> = {
  [K in keyof TAltered as TAltered[K] extends { __renamed: infer RFrom }
    ? RFrom extends keyof TOriginal
      ? never
      : K
    : K]: TAltered[K];
};

type ProcessAlteredTable<TOriginal, TAltered> = Prettify<
  GetFinalSchema<TOriginal, TAltered> & {
    [K in keyof AddedColumns<TOriginal, TAltered> as AddedColumns<
      TOriginal,
      TAltered
    >[K] extends { __dropped: true }
      ? never
      : K]: AddedColumns<TOriginal, TAltered>[K];
  }
>;

type ApplyRenames<TAll, TRenames> = Prettify<
  {
    [K in keyof TAll as K extends keyof TRenames ? never : K]: TAll[K];
  } & {
    [OldName in keyof TRenames as TRenames[OldName] extends PropertyKey
      ? TRenames[OldName]
      : never]: OldName extends keyof TAll ? TAll[OldName] : never;
  }
>;

type FinalizeAlters<TAll, TAltered> = {
  [TableName in keyof TAll | keyof TAltered]: TableName extends keyof TAltered
    ? TableName extends keyof TAll
      ? ProcessAlteredTable<TAll[TableName], TAltered[TableName]>
      : TAltered[TableName]
    : TableName extends keyof TAll
      ? TAll[TableName]
      : never;
};

export type FinalizeSchema<TAll, TAltered, TRenames> =
  TAll extends Record<string, any>
    ? keyof TRenames extends never
      ? FinalizeAlters<TAll, TAltered>
      : FinalizeAlters<ApplyRenames<TAll, TRenames>, TAltered>
    : TAll;
