import { describe, expect, it, vi, afterEach } from "vitest";
import { toAbsoluteHref } from "./assetPaths";

describe("toAbsoluteHref", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("prepends / to relative paths when BASE_URL is /", () => {
    vi.stubEnv("BASE_URL", "/");
    expect(toAbsoluteHref("assets/client-abc123.js")).toBe(
      "/assets/client-abc123.js",
    );
  });

  it("prepends custom base to relative paths", () => {
    vi.stubEnv("BASE_URL", "/app/");
    expect(toAbsoluteHref("assets/client-abc123.js")).toBe(
      "/app/assets/client-abc123.js",
    );
  });

  it("does not double-prefix already absolute paths", () => {
    vi.stubEnv("BASE_URL", "/");
    expect(toAbsoluteHref("/assets/client-abc123.js")).toBe(
      "/assets/client-abc123.js",
    );
  });

  it("handles CSS paths", () => {
    vi.stubEnv("BASE_URL", "/");
    expect(toAbsoluteHref("assets/styles-def456.css")).toBe(
      "/assets/styles-def456.css",
    );
  });
});
