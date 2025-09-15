import { describe, it, expect } from "vitest";
import { ensureAliasArray } from "./ensureAliasArray.mjs";
import type { UserConfig } from "vite";

describe("ensureAliasArray", () => {
  it("should create resolve and alias array if resolve is undefined", () => {
    const config: UserConfig = {};
    const result = ensureAliasArray(config);
    expect(result).toEqual([]);
    expect(config.resolve?.alias).toEqual([]);
    expect(result).toBe(config.resolve?.alias);
  });

  it("should create alias array if alias is undefined", () => {
    const config: UserConfig = { resolve: {} };
    const result = ensureAliasArray(config);
    expect(result).toEqual([]);
    expect(config.resolve?.alias).toEqual([]);
    expect(result).toBe(config.resolve?.alias);
  });

  it("should convert an alias object to an array", () => {
    const config: UserConfig = {
      resolve: {
        alias: {
          find: "/replacement",
          another: "/another-replacement",
        },
      },
    };
    const result = ensureAliasArray(config);
    const expected = [
      { find: "find", replacement: "/replacement" },
      { find: "another", replacement: "/another-replacement" },
    ];
    expect(result).toEqual(expected);
    expect(config.resolve?.alias).toEqual(expected);
    expect(result).toBe(config.resolve?.alias);
  });

  it("should return a clone of an existing alias array", () => {
    const originalAlias = [{ find: "find", replacement: "/replacement" }];
    const config: UserConfig = {
      resolve: {
        alias: originalAlias,
      },
    };
    const result = ensureAliasArray(config);
    expect(result).toEqual(originalAlias);
    expect(result).not.toBe(originalAlias);
    expect(config.resolve?.alias).toEqual(originalAlias);
    expect(config.resolve?.alias).not.toBe(originalAlias);
  });

  it("should handle an empty alias object", () => {
    const config: UserConfig = {
      resolve: {
        alias: {},
      },
    };
    const result = ensureAliasArray(config);
    expect(result).toEqual([]);
    expect(config.resolve?.alias).toEqual([]);
  });

  it("should handle an empty alias array", () => {
    const config: UserConfig = {
      resolve: {
        alias: [],
      },
    };
    const originalAlias = config.resolve?.alias;
    const result = ensureAliasArray(config);
    expect(result).toEqual([]);
    expect(config.resolve?.alias).toEqual([]);
    expect(result).not.toBe(originalAlias);
  });
});
