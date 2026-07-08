import { describe, expect, it } from "vitest";
import {
  getOptimizeDepsExcludePatterns,
  getOptimizeDepsExcludePatternsByEnv,
  isExcludedFromOptimization,
  resolveOptimizeDepsExcludes,
  resolveOptimizeDepsExcludesByEnv,
} from "./resolveOptimizeDepsExcludes.mjs";

describe("getOptimizeDepsExcludePatterns", () => {
  it("should collect root-level excludes", () => {
    const patterns = getOptimizeDepsExcludePatterns({
      optimizeDeps: { exclude: ["foo", "bar"] },
    });
    expect(patterns).toEqual(["foo", "bar"]);
  });

  it("should collect per-environment excludes", () => {
    const patterns = getOptimizeDepsExcludePatterns({
      optimizeDeps: { exclude: ["foo"] },
      environments: {
        client: { optimizeDeps: { exclude: ["bar"] } },
        worker: { optimizeDeps: { exclude: ["baz"] } },
      },
    });
    expect(patterns).toEqual(expect.arrayContaining(["foo", "bar", "baz"]));
    expect(patterns).toHaveLength(3);
  });

  it("should deduplicate excludes across root and environments", () => {
    const patterns = getOptimizeDepsExcludePatterns({
      optimizeDeps: { exclude: ["foo", "bar"] },
      environments: {
        client: { optimizeDeps: { exclude: ["bar", "baz"] } },
      },
    });
    expect(patterns).toEqual(expect.arrayContaining(["foo", "bar", "baz"]));
    expect(patterns).toHaveLength(3);
  });
});

describe("getOptimizeDepsExcludePatternsByEnv", () => {
  it("should apply root-level excludes to every environment", () => {
    const patterns = getOptimizeDepsExcludePatternsByEnv({
      optimizeDeps: { exclude: ["foo"] },
      environments: {
        client: { optimizeDeps: { exclude: [] } },
        worker: { optimizeDeps: { exclude: ["bar"] } },
      },
    });
    expect(patterns.client).toEqual(["foo"]);
    expect(patterns.worker).toEqual(["foo", "bar"]);
  });

  it("should fall back to known environments when none are configured", () => {
    const patterns = getOptimizeDepsExcludePatternsByEnv({
      optimizeDeps: { exclude: ["foo"] },
    });
    expect(patterns.client).toEqual(["foo"]);
    expect(patterns.ssr).toEqual(["foo"]);
    expect(patterns.worker).toEqual(["foo"]);
  });
});

describe("resolveOptimizeDepsExcludes", () => {
  it("should resolve an installed package to its root", () => {
    const roots = resolveOptimizeDepsExcludes(["glob"], process.cwd());
    expect(roots.length).toBe(1);
    expect(roots[0]).toMatch(/node_modules[\/\\]glob$/);
  });

  it("should resolve a scoped package to its root", () => {
    const roots = resolveOptimizeDepsExcludes(
      ["@cloudflare/vite-plugin"],
      process.cwd(),
    );
    expect(roots.length).toBe(1);
    expect(roots[0]).toMatch(/node_modules[\/\\]@cloudflare[\/\\]vite-plugin$/);
  });

  it("should resolve a package subpath to the subpath directory", () => {
    const roots = resolveOptimizeDepsExcludes(["glob/dist"], process.cwd());
    expect(roots.length).toBe(1);
    expect(roots[0]).toMatch(/node_modules[\/\\]glob[\/\\]dist$/);
  });

  it("should resolve a relative path from the project root", () => {
    const roots = resolveOptimizeDepsExcludes(
      ["./sdk/src/vite"],
      process.cwd(),
    );
    expect(roots.length).toBe(1);
    expect(roots[0]).toMatch(/sdk[\/\\]src[\/\\]vite$/);
  });

  it("should fall back to node_modules path for unresolvable patterns", () => {
    const roots = resolveOptimizeDepsExcludes(
      ["this-package-does-not-exist"],
      process.cwd(),
    );
    expect(roots.length).toBe(1);
    expect(roots[0]).toMatch(/node_modules[\/\\]this-package-does-not-exist$/);
  });
});

describe("resolveOptimizeDepsExcludesByEnv", () => {
  it("should resolve per environment", () => {
    const roots = resolveOptimizeDepsExcludesByEnv(
      {
        client: ["glob"],
        worker: ["this-package-does-not-exist"],
      },
      process.cwd(),
    );

    expect(roots.client).toHaveLength(1);
    expect(roots.client![0]).toMatch(/node_modules[\/\\]glob$/);
    expect(roots.worker).toHaveLength(1);
    expect(roots.worker![0]).toMatch(
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

  it("should match Vite-style project-relative paths", () => {
    expect(
      isExcludedFromOptimization(
        "/node_modules/foo/index.js",
        ["/project/node_modules/foo"],
        "/project",
      ),
    ).toBe(true);
  });

  it("should still match external absolute paths that share no common root", () => {
    expect(
      isExcludedFromOptimization(
        "/Users/chris/other/lib/index.js",
        ["/Users/chris/other/lib"],
        "/Users/chris/project",
      ),
    ).toBe(true);
  });

  it("should not match unrelated Vite-style paths", () => {
    expect(
      isExcludedFromOptimization(
        "/node_modules/bar/index.js",
        ["/project/node_modules/foo"],
        "/project",
      ),
    ).toBe(false);
  });
});
