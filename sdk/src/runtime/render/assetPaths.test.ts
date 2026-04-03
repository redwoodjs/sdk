import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { toAbsoluteHref } from "./assetPaths";

describe("toAbsoluteHref", () => {
  const originalEnv = import.meta.env.BASE_URL;

  afterEach(() => {
    import.meta.env.BASE_URL = originalEnv;
  });

  it("prepends / to relative paths when BASE_URL is /", () => {
    import.meta.env.BASE_URL = "/";
    expect(toAbsoluteHref("assets/client-abc123.js")).toBe(
      "/assets/client-abc123.js",
    );
  });

  it("prepends custom base to relative paths", () => {
    import.meta.env.BASE_URL = "/app/";
    expect(toAbsoluteHref("assets/client-abc123.js")).toBe(
      "/app/assets/client-abc123.js",
    );
  });

  it("does not double-prefix already absolute paths", () => {
    import.meta.env.BASE_URL = "/";
    expect(toAbsoluteHref("/assets/client-abc123.js")).toBe(
      "/assets/client-abc123.js",
    );
  });

  it("handles CSS paths", () => {
    import.meta.env.BASE_URL = "/";
    expect(toAbsoluteHref("assets/styles-def456.css")).toBe(
      "/assets/styles-def456.css",
    );
  });

});
