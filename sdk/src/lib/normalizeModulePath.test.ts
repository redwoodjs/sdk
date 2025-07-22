import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { normalizeModulePath } from "./normalizeModulePath.mjs";

describe("normalizeModulePath", () => {
  describe("1. Project-local paths", () => {
    it("Relative file", () => {
      expect(
        normalizeModulePath("src/page.tsx", "/Users/name/code/my-app"),
      ).toBe("/src/page.tsx");
    });
    it("Relative file in subdir", () => {
      expect(
        normalizeModulePath("src/utils/index.ts", "/Users/name/code/my-app"),
      ).toBe("/src/utils/index.ts");
    });
    it("Relative file with ./", () => {
      expect(
        normalizeModulePath("./src/page.tsx", "/Users/name/code/my-app"),
      ).toBe("/src/page.tsx");
    });
    it("Relative file with ../ (external)", () => {
      expect(
        normalizeModulePath("../shared/foo.ts", "/Users/name/code/my-app"),
      ).toBe("/Users/name/code/shared/foo.ts");
    });
  });

  describe("2. Vite-style absolute paths", () => {
    it("Vite-style root import", () => {
      expect(
        normalizeModulePath("/src/page.tsx", "/Users/name/code/my-app"),
      ).toBe("/src/page.tsx");
    });
    it("Vite-style node_modules", () => {
      expect(
        normalizeModulePath("/node_modules/foo.js", "/Users/name/code/my-app"),
      ).toBe("/node_modules/foo.js");
    });
  });

  describe("3. Real absolute paths inside project", () => {
    it("Real abs path (inside)", () => {
      expect(
        normalizeModulePath(
          "/Users/name/code/my-app/src/page.tsx",
          "/Users/name/code/my-app",
        ),
      ).toBe("/src/page.tsx");
    });
    it("Real abs path (deep inside)", () => {
      expect(
        normalizeModulePath(
          "/Users/name/code/my-app/src/features/auth.ts",
          "/Users/name/code/my-app",
        ),
      ).toBe("/src/features/auth.ts");
    });
  });

  describe("4. Real absolute paths outside project", () => {
    it("External shared pkg", () => {
      expect(
        normalizeModulePath(
          "/Users/name/code/my-monorepo/packages/shared/utils.ts",
          "/Users/name/code/my-monorepo/packages/app",
        ),
      ).toBe("/Users/name/code/my-monorepo/packages/shared/utils.ts");
    });
    it("External node_modules", () => {
      expect(
        normalizeModulePath(
          "/Users/name/code/my-monorepo/node_modules/foo/index.js",
          "/Users/name/code/my-monorepo/packages/app",
        ),
      ).toBe("/Users/name/code/my-monorepo/node_modules/foo/index.js");
    });
    it("Completely external path", () => {
      expect(
        normalizeModulePath("/opt/tools/logger.ts", "/Users/name/code/my-app"),
      ).toBe("/opt/tools/logger.ts");
    });
  });

  describe("5. Absolute option", () => {
    describe("Project-local paths with absolute option", () => {
      it("Relative file", () => {
        expect(
          normalizeModulePath("src/page.tsx", "/Users/name/code/my-app", {
            absolute: true,
          }),
        ).toBe("/Users/name/code/my-app/src/page.tsx");
      });
      it("Relative file in subdir", () => {
        expect(
          normalizeModulePath("src/utils/index.ts", "/Users/name/code/my-app", {
            absolute: true,
          }),
        ).toBe("/Users/name/code/my-app/src/utils/index.ts");
      });
      it("Relative file with ./", () => {
        expect(
          normalizeModulePath("./src/page.tsx", "/Users/name/code/my-app", {
            absolute: true,
          }),
        ).toBe("/Users/name/code/my-app/src/page.tsx");
      });
      it("Relative file with ../ (external)", () => {
        expect(
          normalizeModulePath("../shared/foo.ts", "/Users/name/code/my-app", {
            absolute: true,
          }),
        ).toBe("/Users/name/code/shared/foo.ts");
      });
    });

    describe("Vite-style absolute paths with absolute option", () => {
      it("Vite-style root import", () => {
        expect(
          normalizeModulePath("/src/page.tsx", "/Users/name/code/my-app", {
            absolute: true,
          }),
        ).toBe("/Users/name/code/my-app/src/page.tsx");
      });
      it("Vite-style node_modules", () => {
        expect(
          normalizeModulePath(
            "/node_modules/foo.js",
            "/Users/name/code/my-app",
            { absolute: true },
          ),
        ).toBe("/Users/name/code/my-app/node_modules/foo.js");
      });
    });

    describe("Real absolute paths with absolute option", () => {
      it("Real abs path (inside)", () => {
        expect(
          normalizeModulePath(
            "/Users/name/code/my-app/src/page.tsx",
            "/Users/name/code/my-app",
            { absolute: true },
          ),
        ).toBe("/Users/name/code/my-app/src/page.tsx");
      });
      it("Real abs path (deep inside)", () => {
        expect(
          normalizeModulePath(
            "/Users/name/code/my-app/src/features/auth.ts",
            "/Users/name/code/my-app",
            { absolute: true },
          ),
        ).toBe("/Users/name/code/my-app/src/features/auth.ts");
      });
      it("External shared pkg", () => {
        expect(
          normalizeModulePath(
            "/Users/name/code/my-monorepo/packages/shared/utils.ts",
            "/Users/name/code/my-monorepo/packages/app",
            { absolute: true },
          ),
        ).toBe("/Users/name/code/my-monorepo/packages/shared/utils.ts");
      });
      it("External node_modules", () => {
        expect(
          normalizeModulePath(
            "/Users/name/code/my-monorepo/node_modules/foo/index.js",
            "/Users/name/code/my-monorepo/packages/app",
            { absolute: true },
          ),
        ).toBe("/Users/name/code/my-monorepo/node_modules/foo/index.js");
      });
      it("Completely external path", () => {
        expect(
          normalizeModulePath(
            "/opt/tools/logger.ts",
            "/Users/name/code/my-app",
            { absolute: true },
          ),
        ).toBe("/opt/tools/logger.ts");
      });
    });

    describe("Edge cases with absolute option", () => {
      it("Empty string", () => {
        expect(
          normalizeModulePath("", "/Users/name/code/my-app", {
            absolute: true,
          }),
        ).toBe("/Users/name/code/my-app");
      });
      it("Dot current dir", () => {
        expect(
          normalizeModulePath(".", "/Users/name/code/my-app", {
            absolute: true,
          }),
        ).toBe("/Users/name/code/my-app");
      });
      it("Dot parent dir", () => {
        expect(
          normalizeModulePath("..", "/Users/name/code/my-app", {
            absolute: true,
          }),
        ).toBe("/Users/name/code");
      });
      it("Trailing slash", () => {
        expect(
          normalizeModulePath("src/", "/Users/name/code/my-app", {
            absolute: true,
          }),
        ).toBe("/Users/name/code/my-app/src");
      });
      it("Leading and trailing slashes", () => {
        expect(
          normalizeModulePath("/src/", "/Users/name/code/my-app", {
            absolute: true,
          }),
        ).toBe("/Users/name/code/my-app/src");
      });
    });

    describe("Project root is / with absolute option", () => {
      it("Root-based path", () => {
        expect(
          normalizeModulePath("/src/index.ts", "/", { absolute: true }),
        ).toBe("/src/index.ts");
      });
      it("System path", () => {
        expect(normalizeModulePath("/etc/hosts", "/", { absolute: true })).toBe(
          "/etc/hosts",
        );
      });
    });
  });

  describe("6. Edge and weird cases", () => {
    it("Empty string", () => {
      expect(normalizeModulePath("", "/Users/name/code/my-app")).toBe("/");
    });
    it("Dot current dir", () => {
      expect(normalizeModulePath(".", "/Users/name/code/my-app")).toBe("/");
    });
    it("Dot parent dir", () => {
      expect(normalizeModulePath("..", "/Users/name/code/my-app")).toBe(
        "/Users/name/code",
      );
    });
    it("Trailing slash", () => {
      expect(normalizeModulePath("src/", "/Users/name/code/my-app")).toBe(
        "/src",
      );
    });
    it("Leading and trailing slashes", () => {
      expect(normalizeModulePath("/src/", "/Users/name/code/my-app")).toBe(
        "/src",
      );
    });
  });

  describe("7. Project root is /", () => {
    it("Root-based path", () => {
      expect(normalizeModulePath("/src/index.ts", "/")).toBe("/src/index.ts");
    });
    it("System path", () => {
      expect(normalizeModulePath("/etc/hosts", "/")).toBe("/etc/hosts");
    });
  });
});
