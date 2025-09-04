import { describe, it, expect } from "vitest";
import { mapViteResolveToEnhancedResolveOptions } from "./createViteAwareResolver.mjs";
import { ResolvedConfig } from "vite";

describe("mapViteResolveToEnhancedResolveOptions", () => {
  it("should correctly map Vite aliases to enhanced-resolve format", () => {
    const mockConfig = {
      environments: {
        worker: {
          resolve: {
            alias: [
              { find: "@", replacement: "/src" },
              { find: "react$", replacement: "/custom/react" },
              { find: /^~/, replacement: "/node_modules/" },
            ],
          },
        },
      },
    } as unknown as ResolvedConfig;

    const options = mapViteResolveToEnhancedResolveOptions(
      mockConfig,
      "worker",
    );

    expect(options.alias).toEqual({
      "@": "/src",
      react$: "/custom/react",
      "^~": "/node_modules/",
    });
  });

  it("should correctly map Vite aliases in object format", () => {
    const mockConfig = {
      environments: {
        worker: {
          resolve: {
            alias: {
              "@": "/src",
              react$: "/custom/react",
            },
          },
        },
      },
    } as unknown as ResolvedConfig;

    const options = mapViteResolveToEnhancedResolveOptions(
      mockConfig,
      "worker",
    );

    expect(options.alias).toEqual({
      "@": "/src",
      react$: "/custom/react",
    });
  });

  it("should correctly map other Vite resolve options", () => {
    const mockConfig = {
      environments: {
        worker: {
          resolve: {
            conditions: ["node", "import"],
            mainFields: ["module", "main"],
            extensions: [".js", "ts"],
            preserveSymlinks: true,
          },
        },
      },
    } as unknown as ResolvedConfig;

    const options = mapViteResolveToEnhancedResolveOptions(
      mockConfig,
      "worker",
    );

    expect(options.conditionNames).toEqual(["node", "import"]);
    expect(options.mainFields).toEqual(["module", "main"]);
    expect(options.extensions).toEqual([".js", "ts"]);
    expect(options.symlinks).toBe(true);
  });
});
