declare module "is-even" {
  function isEven(value: number): boolean;
  export = isEven;
}

declare module "is-odd" {
  function isOdd(value: number): boolean;
  export = isOdd;
}

declare module "is-number" {
  function isNumber(value: any): value is number;
  export = isNumber;
}
