import { describe, expect, it } from "vitest";
import {
  findCommonAncestorDepth,
  normalizeModulePath,
} from "./normalizeModulePath.mjs";

describe("findCommonAncestorDepth", () => {
  it("should return the correct depth for common paths", () => {
    expect(findCommonAncestorDepth("/a/b/c", "/a/b/d")).toBe(2);
  });

  it("should return 0 for completely different paths", () => {
    expect(findCommonAncestorDepth("/a/b/c", "/d/e/f")).toBe(0);
  });

  it("should handle identical paths", () => {
    expect(findCommonAncestorDepth("/a/b/c", "/a/b/c")).toBe(3);
  });

  it("should handle paths of different lengths", () => {
    expect(findCommonAncestorDepth("/a/b/c", "/a/b/c/d/e")).toBe(3);
  });

  it("should handle the root path", () => {
    expect(findCommonAncestorDepth("/", "/a/b")).toBe(0);
    expect(findCommonAncestorDepth("/a", "/")).toBe(0);
    expect(findCommonAncestorDepth("/", "/")).toBe(0);
  });
});

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
            {
              absolute: true,
              isViteStyle: false,
            },
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

  describe("8. isViteStyle option", () => {
    describe("isViteStyle: false (treat as external)", () => {
      it("System path that would normally be Vite-style", () => {
        expect(
          normalizeModulePath(
            "/opt/tools/logger.ts",
            "/Users/name/code/my-app",
            {
              isViteStyle: false,
            },
          ),
        ).toBe("/opt/tools/logger.ts");
      });
      it("Src path with isViteStyle: false", () => {
        expect(
          normalizeModulePath("/src/page.tsx", "/Users/name/code/my-app", {
            isViteStyle: false,
          }),
        ).toBe("/src/page.tsx");
      });
      it("With absolute option", () => {
        expect(
          normalizeModulePath(
            "/opt/tools/logger.ts",
            "/Users/name/code/my-app",
            {
              absolute: true,
              isViteStyle: false,
            },
          ),
        ).toBe("/opt/tools/logger.ts");
      });
    });

    describe("isViteStyle: true (force Vite-style)", () => {
      it("System path forced to Vite-style", () => {
        expect(
          normalizeModulePath(
            "/opt/tools/logger.ts",
            "/Users/name/code/my-app",
            {
              isViteStyle: true,
            },
          ),
        ).toBe("/opt/tools/logger.ts");
      });
      it("Src path with isViteStyle: true", () => {
        expect(
          normalizeModulePath("/src/page.tsx", "/Users/name/code/my-app", {
            isViteStyle: true,
          }),
        ).toBe("/src/page.tsx");
      });
      it("With absolute option", () => {
        expect(
          normalizeModulePath("/src/page.tsx", "/Users/name/code/my-app", {
            absolute: true,
            isViteStyle: true,
          }),
        ).toBe("/Users/name/code/my-app/src/page.tsx");
      });
      it("System path forced to Vite-style with absolute option", () => {
        expect(
          normalizeModulePath(
            "/opt/tools/logger.ts",
            "/Users/name/code/my-app",
            {
              absolute: true,
              isViteStyle: true,
            },
          ),
        ).toBe("/Users/name/code/my-app/opt/tools/logger.ts");
      });
    });
  });
});
