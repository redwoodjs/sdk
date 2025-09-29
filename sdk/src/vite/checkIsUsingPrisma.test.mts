import { describe, expect, it } from "vitest";
import { isUsingPrisma } from "./checkIsUsingPrisma.mjs";

describe("isUsingPrisma", () => {
  it("should return true if prisma client is resolved", () => {
    const resolver = () => "/path/to/prisma/client";
    const result = isUsingPrisma({
      projectRootDir: "/test/project",
      resolver: resolver as any,
    });
    expect(result).toBe(true);
  });

  it("should return false if prisma client is not resolved", () => {
    const resolver = () => false;
    const result = isUsingPrisma({
      projectRootDir: "/test/project",
      resolver: resolver as any,
    });
    expect(result).toBe(false);
  });

  it("should return false if resolver throws", () => {
    const resolver = () => {
      throw new Error("Module not found");
    };
    const result = isUsingPrisma({
      projectRootDir: "/test/project",
      resolver: resolver as any,
    });
    expect(result).toBe(false);
  });
});
