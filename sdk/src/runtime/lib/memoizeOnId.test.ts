import { describe, expect, it, vi } from "vitest";
import { memoizeOnId } from "./memoizeOnId";

describe("memoizeOnId", () => {
  it("should call the function only once for the same id", () => {
    const fn = vi.fn((id: string) => `result-${id}`);
    const memoizedFn = memoizeOnId(fn);

    const result1 = memoizedFn("a");
    const result2 = memoizedFn("a");

    expect(result1).toBe("result-a");
    expect(result2).toBe("result-a");
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith("a");
  });

  it("should call the function again for a different id", () => {
    const fn = vi.fn((id: string) => `result-${id}`);
    const memoizedFn = memoizeOnId(fn);

    const result1 = memoizedFn("a");
    const result2 = memoizedFn("b");

    expect(result1).toBe("result-a");
    expect(result2).toBe("result-b");
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenCalledWith("a");
    expect(fn).toHaveBeenCalledWith("b");
  });

  it("should return the correct cached value for multiple calls", () => {
    const fn = vi.fn((id: string) => ({ id }));
    const memoizedFn = memoizeOnId(fn);

    const resultA1 = memoizedFn("a");
    const resultB1 = memoizedFn("b");
    const resultA2 = memoizedFn("a");

    expect(resultA1).toEqual({ id: "a" });
    expect(resultB1).toEqual({ id: "b" });
    expect(resultA2).toBe(resultA1); // Should be the same object reference
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("should handle object properties that exist on Object.prototype", () => {
    const fn = vi.fn((id: string) => `result-${id}`);
    const memoizedFn = memoizeOnId(fn);

    const result1 = memoizedFn("constructor");
    const result2 = memoizedFn("toString");
    const result3 = memoizedFn("constructor");

    expect(result1).toBe("result-constructor");
    expect(result2).toBe("result-toString");
    expect(result3).toBe("result-constructor");
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenCalledWith("constructor");
    expect(fn).toHaveBeenCalledWith("toString");
  });
});
