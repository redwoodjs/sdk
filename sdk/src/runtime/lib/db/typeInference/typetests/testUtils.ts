export type Equal<X, Y> =
  (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2
    ? true
    : false;
export type Expect<T extends true> = T;

export type ExpectDb<
  TActual,
  TExpected,
  TResult extends true = Equal<Omit<TActual, "__kyselySchema">, TExpected>
> = TResult;
