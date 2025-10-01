// The following type assertion will fail if our AlterTableBuilder is missing
// any methods from Kysely's AlterTableBuilder.
export type AssertStillImplements<OurBuilder, KyselyBuilder> =
  keyof KyselyBuilder extends keyof OurBuilder ? true : false;

export type Assert<T extends true> = T;
