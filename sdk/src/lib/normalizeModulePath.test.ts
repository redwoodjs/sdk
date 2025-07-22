import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { normalizeModulePath } from "./normalizeModulePath.mjs";

describe("normalizeModulePath", () => {
  const projectRootDir = "/Users/justin/code/my-app";

  describe("1. Project-local paths", () => {
    it("Relative file", () => {
      expect(normalizeModulePath("src/page.tsx", projectRootDir)).toBe(
        "/src/page.tsx",
      );
    });
    it("Relative file in subdir", () => {
      expect(normalizeModulePath("src/utils/index.ts", projectRootDir)).toBe(
        "/src/utils/index.ts",
      );
    });
    it("Relative file with ./", () => {
      expect(normalizeModulePath("./src/page.tsx", projectRootDir)).toBe(
        "/src/page.tsx",
      );
    });
    it("Relative file with ../", () => {
      expect(normalizeModulePath("../shared/foo.ts", projectRootDir)).toBe(
        "/../shared/foo.ts",
      );
    });
  });

  describe("2. Vite-style absolute paths", () => {
    it("Vite-style root import", () => {
      expect(normalizeModulePath("/src/page.tsx", projectRootDir)).toBe(
        "/src/page.tsx",
      );
    });
    it("Vite-style node_modules", () => {
      expect(normalizeModulePath("/node_modules/foo.js", projectRootDir)).toBe(
        "/node_modules/foo.js",
      );
    });
  });

  describe("3. Real absolute paths inside project", () => {
    it("Real abs path (inside)", () => {
      expect(
        normalizeModulePath(
          "/Users/justin/code/my-app/src/page.tsx",
          projectRootDir,
        ),
      ).toBe("/src/page.tsx");
    });
    it("Real abs path (deep inside)", () => {
      expect(
        normalizeModulePath(
          "/Users/justin/code/my-app/src/features/auth.ts",
          projectRootDir,
        ),
      ).toBe("/src/features/auth.ts");
    });
  });

  describe("4. Real absolute paths outside project", () => {
    it("External shared pkg", () => {
      expect(
        normalizeModulePath(
          "/Users/justin/code/my-monorepo/packages/shared/utils.ts",
          projectRootDir,
        ),
      ).toBe("/../my-monorepo/packages/shared/utils.ts");
    });
    it("External node_modules", () => {
      expect(
        normalizeModulePath(
          "/Users/justin/code/my-monorepo/node_modules/foo/index.js",
          projectRootDir,
        ),
      ).toBe("/../my-monorepo/node_modules/foo/index.js");
    });
    it("Completely external path", () => {
      expect(normalizeModulePath("/opt/tools/logger.ts", projectRootDir)).toBe(
        "/../../opt/tools/logger.ts",
      );
    });
  });

  describe("6. Edge and weird cases", () => {
    it("Empty string", () => {
      expect(normalizeModulePath("", projectRootDir)).toBe("/");
    });
    it("Dot current dir", () => {
      expect(normalizeModulePath(".", projectRootDir)).toBe("/");
    });
    it("Dot parent dir", () => {
      expect(normalizeModulePath("..", projectRootDir)).toBe("/..");
    });
    it("Trailing slash", () => {
      expect(normalizeModulePath("src/", projectRootDir)).toBe("/src");
    });
    it("Leading and trailing slashes", () => {
      expect(normalizeModulePath("/src/", projectRootDir)).toBe("/src");
    });
  });

  describe("7. Project root is /", () => {
    const rootProjectRootDir = "/";
    it("Root-based path", () => {
      expect(normalizeModulePath("/src/index.ts", rootProjectRootDir)).toBe(
        "/src/index.ts",
      );
    });
    it("System path", () => {
      expect(normalizeModulePath("/etc/hosts", rootProjectRootDir)).toBe(
        "/etc/hosts",
      );
    });
  });
});
