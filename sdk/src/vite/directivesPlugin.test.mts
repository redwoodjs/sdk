import { describe, expect, it } from "vitest";
import { getLoader } from "./directivesPlugin.mjs";

describe("getLoader", () => {
  const testCases = [
    { path: "file.js", expected: "js" },
    { path: "file.mjs", expected: "js" },
    { path: "file.cjs", expected: "js" },
    { path: "file.ts", expected: "ts" },
    { path: "file.mts", expected: "ts" },
    { path: "file.cts", expected: "ts" },
    { path: "file.jsx", expected: "jsx" },
    { path: "file.tsx", expected: "tsx" },
    { path: "/path/to/component.ts", expected: "ts" },
    { path: "../relative/path.jsx", expected: "jsx" },
    { path: "file.css", expected: "js" }, // default case
    { path: "file.json", expected: "js" }, // default case
    { path: "file", expected: "js" }, // no extension
  ];

  testCases.forEach(({ path, expected }) => {
    it(`should return "${expected}" for "${path}"`, () => {
      expect(getLoader(path)).toBe(expected);
    });
  });
});
