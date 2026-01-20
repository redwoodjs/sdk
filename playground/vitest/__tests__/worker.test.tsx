import { describe, it, expect } from "vitest";
import { defineApp } from "rwsdk/worker";

describe("Worker", () => {
  it("should be able to import defineApp", () => {
    expect(defineApp).toBeDefined();
  });
});
