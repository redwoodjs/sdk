import { describe, expect, it } from "vitest";
import { stripBase } from "./stripBase.mjs";

describe("stripBase", () => {
  it("should strip base prefix from path", () => {
    expect(stripBase("/auth/src/client.tsx", "/auth/")).toBe(
      "/src/client.tsx",
    );
  });

  it("should be a no-op when base is /", () => {
    expect(stripBase("/src/client.tsx", "/")).toBe("/src/client.tsx");
  });

  it("should be a no-op when path does not start with base", () => {
    expect(stripBase("/src/client.tsx", "/auth/")).toBe("/src/client.tsx");
  });

  it("should handle path equal to base", () => {
    expect(stripBase("/auth/", "/auth/")).toBe("/");
  });

  it("should handle multi-level base paths", () => {
    expect(stripBase("/org/app/src/client.tsx", "/org/app/")).toBe(
      "/src/client.tsx",
    );
  });

  it("should be a no-op when base is empty string", () => {
    expect(stripBase("/src/client.tsx", "")).toBe("/src/client.tsx");
  });
});
