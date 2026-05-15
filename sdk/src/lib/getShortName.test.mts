import path from "node:path";
import { describe, expect, it } from "vitest";
import { getShortName } from "./getShortName.mjs";

describe("getShortName", () => {
  it("should return the relative path if the file is inside the root", () => {
    const root = path.join("/Users", "test", "project");
    const file = path.join(root, "src", "index.ts");
    expect(getShortName(file, root)).toBe(path.join("src", "index.ts"));
  });

  it("should return the original path if the file is outside the root", () => {
    const root = path.join("/Users", "test", "project");
    const file = path.join(
      "/Users",
      "test",
      "another",
      "project",
      "src",
      "index.ts",
    );
    expect(getShortName(file, root)).toBe(file);
  });

  it("should return an empty string if the paths are identical", () => {
    const root = path.join("/Users", "test", "project");
    const file = path.join("/Users", "test", "project");
    expect(getShortName(file, root)).toBe("");
  });

  it("should handle paths that are substrings of each other correctly", () => {
    const root = path.join("/Users", "test", "project");
    const file = path.join(
      "/Users",
      "test",
      "project-longer",
      "src",
      "index.ts",
    );
    expect(getShortName(file, root)).toBe(file);
  });
});
