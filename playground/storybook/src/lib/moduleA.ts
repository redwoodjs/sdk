import { b } from "./moduleB";

export const a = () => {
  b();
  // trigger hmr
  return "a";
};
