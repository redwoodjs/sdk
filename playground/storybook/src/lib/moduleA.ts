import { B } from "./moduleB";

export const A = {
  name: "A", // trigger hmr
  b: B,
};
