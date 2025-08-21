export const isClientReference = (value: any) => {
  return Object.prototype.hasOwnProperty.call(value, "$$isClientReference");
};
