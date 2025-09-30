import { beforeEach, describe, expect, it } from "vitest";
import { _resetPkgCache, hasPkgScript } from "./hasPkgScript.mjs";

// Manually reset the cache before each test
beforeEach(() => {
  _resetPkgCache();
});

describe("hasPkgScript", () => {
  it("should return the script if it exists", async () => {
    const fakeReadFile = async () =>
      JSON.stringify({ scripts: { "dev:init": "command" } });
    const result = await hasPkgScript("/test", "dev:init", fakeReadFile as any);
    expect(result).toBe("command");
  });

  it("should return undefined if the script does not exist", async () => {
    const fakeReadFile = async () =>
      JSON.stringify({ scripts: { test: "command" } });
    const result = await hasPkgScript("/test", "dev:init", fakeReadFile as any);
    expect(result).toBeUndefined();
  });

  it("should return undefined if scripts block does not exist", async () => {
    const fakeReadFile = async () => JSON.stringify({});
    const result = await hasPkgScript("/test", "dev:init", fakeReadFile as any);
    expect(result).toBeUndefined();
  });

  it("should cache the package.json read", async () => {
    let readCount = 0;
    const fakeReadFile = async () => {
      readCount++;
      return JSON.stringify({ scripts: { "dev:init": "command" } });
    };

    await hasPkgScript("/test", "dev:init", fakeReadFile as any);
    await hasPkgScript("/test", "dev:init", fakeReadFile as any);

    expect(readCount).toBe(1);
  });
});
