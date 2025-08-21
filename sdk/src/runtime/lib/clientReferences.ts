export const isClientReference = (value: any) => {
  return (
    Object.prototype.hasOwnProperty.call(value, "$$isClientReference") ||
    Object.prototype.hasOwnProperty.call(
      value,
      "__rwsdk__is_client_wrapped_component",
    )
  );
};
