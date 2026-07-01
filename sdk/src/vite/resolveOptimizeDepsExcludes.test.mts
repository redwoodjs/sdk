import { describe, expect, it } from "vitest";
import {
  isExcludedFromOptimization,
  resolveOptimizeDepsExcludes,
} from "./resolveOptimizeDepsExcludes.mjs";

describe("resolveOptimizeDepsExcludes", () => {
  it("should resolve an installed package to its root", async () => {
    const roots = await resolveOptimizeDepsExcludes(["glob"], process.cwd());
    expect(roots.length).toBe(1);
    expect(roots[0]).toMatch(/node_modules[\/\\]glob$/);
  });

  it("should resolve a scoped package to its root", async () => {
    const roots = await resolveOptimizeDepsExcludes(
      ["@cloudflare/vite-plugin"],
      process.cwd(),
    );
    expect(roots.length).toBe(1);
    expect(roots[0]).toMatch(
      /node_modules[\/\\]@cloudflare[\/\\]vite-plugin$/,
    );
  });

  it("should resolve a package subpath to the subpath directory", async () => {
    const roots = await resolveOptimizeDepsExcludes(
      ["glob/dist"],
      process.cwd(),
    );
    expect(roots.length).toBe(1);
    expect(roots[0]).toMatch(/node_modules[\/\\]glob[\/\\]dist$/);
  });

  it("should resolve a relative path from the project root", async () => {
    const roots = await resolveOptimizeDepsExcludes(
      ["./sdk/src/vite"],
      process.cwd(),
    );
    expect(roots.length).toBe(1);
    expect(roots[0]).toMatch(/sdk[\/\\]src[\/\\]vite$/);
  });

  it("should fall back to node_modules path for unresolvable patterns", async () => {
    const roots = await resolveOptimizeDepsExcludes(
      ["this-package-does-not-exist"],
      process.cwd(),
    );
    expect(roots.length).toBe(1);
    expect(roots[0]).toMatch(
      /node_modules[\/\\]this-package-does-not-exist$/,
    );
  });
});

describe("isExcludedFromOptimization", () => {
  it("should match files under an excluded root", () => {
    expect(
      isExcludedFromOptimization("/project/node_modules/foo/index.js", [
        "/project/node_modules/foo",
      ]),
    ).toBe(true);
  });

  it("should not match files outside excluded roots", () => {
    expect(
      isExcludedFromOptimization("/project/node_modules/bar/index.js", [
        "/project/node_modules/foo",
      ]),
    ).toBe(false);
  });

  it("should handle roots without trailing separators", () => {
    expect(
      isExcludedFromOptimization("/project/node_modules/foo/index.js", [
        "/project/node_modules/foo/",
      ]),
    ).toBe(true);
  });

  it("should resolve root-relative files against the project root", () => {
    expect(
      isExcludedFromOptimization(
        "node_modules/foo/index.js",
        ["/project/node_modules/foo"],
        "/project",
      ),
    ).toBe(true);
  });
});
