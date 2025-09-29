import { describe, expect, it } from "vitest";
import { isJsFile } from "./isJsFile.mjs";

describe("isJsFile", () => {
  const matchingExtensions = [
    "file.js",
    "file.jsx",
    "file.ts",
    "file.tsx",
    "file.mjs",
    "file.mts",
    "file.cjs",
    "file.cts",
    "/path/to/component.js",
    "../relative/path.tsx",
  ];

  const nonMatchingExtensions = [
    "file.css",
    "file.html",
    "file.json",
    "file.txt",
    "file.js.map",
    "file_js",
    "filejs",
    "",
    "no-extension",
    "/path/to/image.png",
  ];

  matchingExtensions.forEach((filepath) => {
    it(`should return true for "${filepath}"`, () => {
      expect(isJsFile(filepath)).toBe(true);
    });
  });

  nonMatchingExtensions.forEach((filepath) => {
    it(`should return false for "${filepath}"`, () => {
      expect(isJsFile(filepath)).toBe(false);
    });
  });
});
