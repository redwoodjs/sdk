export interface AlterColumnBuilder {
  setDataType<T extends string>(
    dataType: T,
  ): AlteredColumnBuilder<"setDataType", T>;
  setDefault<T>(value: T): AlteredColumnBuilder<"setDefault", T>;
  dropDefault(): AlteredColumnBuilder<"dropDefault", true>;
  setNotNull(): AlteredColumnBuilder<"setNotNull", true>;
  dropNotNull(): AlteredColumnBuilder<"dropNotNull", true>;
}

export interface AlteredColumnBuilder<Kind extends string, Value> {
  readonly kind: Kind;
  readonly value: Value;
}

export type AlterColumnBuilderCallback = (
  builder: AlterColumnBuilder,
) => AlteredColumnBuilder<any, any>;
