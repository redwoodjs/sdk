import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createViteAwareResolver,
  mapViteResolveToEnhancedResolveOptions,
} from "./createViteAwareResolver.mjs";
import { ResolvedConfig } from "vite";
import path from "path";
import fs from "fs";

describe("createViteAwareResolver", () => {
  const mockProjectRoot = "/mock/project";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("alias resolution", () => {
    it("should resolve star aliases correctly", async () => {
      const mockConfig = {
        root: mockProjectRoot,
        environments: {
          worker: {
            resolve: {
              alias: [
                {
                  find: "@/*",
                  replacement: path.join(mockProjectRoot, "src/*"),
                },
              ],
            },
          },
        },
      } as unknown as ResolvedConfig;

      const resolver = createViteAwareResolver(mockConfig, "worker");

      return new Promise<void>((resolve, reject) => {
        resolver(
          {},
          mockProjectRoot,
          "@/components/Button",
          {},
          (err, result) => {
            if (err) {
              reject(err);
            } else {
              expect(result).toBe(
                path.join(mockProjectRoot, "src/components/Button"),
              );
              resolve();
            }
          },
        );
      });
    });

    it("should resolve simple aliases correctly", async () => {
      const mockConfig = {
        root: mockProjectRoot,
        environments: {
          worker: {
            resolve: {
              alias: {
                "@": path.join(mockProjectRoot, "src"),
                utils: path.join(mockProjectRoot, "src/utils"),
              },
            },
          },
        },
      } as unknown as ResolvedConfig;

      const resolver = createViteAwareResolver(mockConfig, "worker");

      return new Promise<void>((resolve, reject) => {
        resolver(
          {},
          mockProjectRoot,
          "@/components/Button",
          {},
          (err, result) => {
            if (err) {
              reject(err);
            } else {
              expect(result).toBe(
                path.join(mockProjectRoot, "src/components/Button"),
              );
              resolve();
            }
          },
        );
      });
    });

    it("should resolve regex aliases correctly", async () => {
      const mockConfig = {
        root: mockProjectRoot,
        environments: {
          worker: {
            resolve: {
              alias: [
                {
                  find: /^~/,
                  replacement: path.join(mockProjectRoot, "node_modules/"),
                },
              ],
            },
          },
        },
      } as unknown as ResolvedConfig;

      const resolver = createViteAwareResolver(mockConfig, "worker");

      return new Promise<void>((resolve, reject) => {
        resolver({}, mockProjectRoot, "~/some-package", {}, (err, result) => {
          if (err) {
            reject(err);
          } else {
            expect(result).toBe(
              path.join(mockProjectRoot, "node_modules/some-package"),
            );
            resolve();
          }
        });
      });
    });
  });

  describe("Vite plugin integration", () => {
    it("should use Vite plugins when enhanced-resolve cannot resolve", async () => {
      const mockResolveId = vi.fn().mockResolvedValue("/custom/resolved/path");

      const mockEnvironment = {
        plugins: [
          {
            name: "test-plugin",
            resolveId: mockResolveId,
          },
        ],
      };

      const mockConfig = {
        root: mockProjectRoot,
        environments: {
          worker: {
            resolve: {},
          },
        },
      } as unknown as ResolvedConfig;

      const resolver = createViteAwareResolver(
        mockConfig,
        "worker",
        mockEnvironment,
      );

      return new Promise<void>((resolve, reject) => {
        resolver({}, mockProjectRoot, "custom-module", {}, (err, result) => {
          if (err) {
            reject(err);
          } else {
            expect(result).toBe("/custom/resolved/path");
            expect(mockResolveId).toHaveBeenCalledWith(
              "custom-module",
              mockProjectRoot,
              { scan: true, isEntry: false, attributes: {} },
            );
            resolve();
          }
        });
      });
    });

    it("should handle plugin resolveId returning object format", async () => {
      const mockResolveId = vi.fn().mockResolvedValue({
        id: "/custom/resolved/path",
        external: false,
      });

      const mockEnvironment = {
        plugins: [
          {
            name: "test-plugin",
            resolveId: mockResolveId,
          },
        ],
      };

      const mockConfig = {
        root: mockProjectRoot,
        environments: {
          worker: {
            resolve: {},
          },
        },
      } as unknown as ResolvedConfig;

      const resolver = createViteAwareResolver(
        mockConfig,
        "worker",
        mockEnvironment,
      );

      return new Promise<void>((resolve, reject) => {
        resolver({}, mockProjectRoot, "custom-module", {}, (err, result) => {
          if (err) {
            reject(err);
          } else {
            expect(result).toBe("/custom/resolved/path");
            resolve();
          }
        });
      });
    });

    it("should try multiple plugins until one resolves", async () => {
      const mockResolveId1 = vi.fn().mockResolvedValue(null);
      const mockResolveId2 = vi
        .fn()
        .mockResolvedValue("/resolved/by/second/plugin");

      const mockEnvironment = {
        plugins: [
          {
            name: "first-plugin",
            resolveId: mockResolveId1,
          },
          {
            name: "second-plugin",
            resolveId: mockResolveId2,
          },
        ],
      };

      const mockConfig = {
        root: mockProjectRoot,
        environments: {
          worker: {
            resolve: {},
          },
        },
      } as unknown as ResolvedConfig;

      const resolver = createViteAwareResolver(
        mockConfig,
        "worker",
        mockEnvironment,
      );

      return new Promise<void>((resolve, reject) => {
        resolver({}, mockProjectRoot, "custom-module", {}, (err, result) => {
          if (err) {
            reject(err);
          } else {
            expect(result).toBe("/resolved/by/second/plugin");
            expect(mockResolveId1).toHaveBeenCalled();
            expect(mockResolveId2).toHaveBeenCalled();
            resolve();
          }
        });
      });
    });

    it("should handle plugin errors gracefully and continue to next plugin", async () => {
      const mockResolveId1 = vi
        .fn()
        .mockRejectedValue(new Error("Plugin error"));
      const mockResolveId2 = vi
        .fn()
        .mockResolvedValue("/resolved/by/second/plugin");

      const mockEnvironment = {
        plugins: [
          {
            name: "failing-plugin",
            resolveId: mockResolveId1,
          },
          {
            name: "working-plugin",
            resolveId: mockResolveId2,
          },
        ],
      };

      const mockConfig = {
        root: mockProjectRoot,
        environments: {
          worker: {
            resolve: {},
          },
        },
      } as unknown as ResolvedConfig;

      const resolver = createViteAwareResolver(
        mockConfig,
        "worker",
        mockEnvironment,
      );

      return new Promise<void>((resolve, reject) => {
        resolver({}, mockProjectRoot, "custom-module", {}, (err, result) => {
          if (err) {
            reject(err);
          } else {
            expect(result).toBe("/resolved/by/second/plugin");
            expect(mockResolveId1).toHaveBeenCalled();
            expect(mockResolveId2).toHaveBeenCalled();
            resolve();
          }
        });
      });
    });

    it("should fall back to enhanced-resolve when no plugins can resolve", async () => {
      const mockResolveId = vi.fn().mockResolvedValue(null);

      const mockEnvironment = {
        plugins: [
          {
            name: "test-plugin",
            resolveId: mockResolveId,
          },
        ],
      };

      const mockConfig = {
        root: mockProjectRoot,
        environments: {
          worker: {
            resolve: {},
          },
        },
      } as unknown as ResolvedConfig;

      const resolver = createViteAwareResolver(
        mockConfig,
        "worker",
        mockEnvironment,
      );

      return new Promise<void>((resolve, reject) => {
        resolver(
          {},
          mockProjectRoot,
          "non-existent-module",
          {},
          (err, result) => {
            // Should not resolve but should not error either
            expect(mockResolveId).toHaveBeenCalled();
            if (!result) {
              // This is expected for non-existent modules
              resolve();
            } else {
              reject(new Error(`Expected no resolution but got: ${result}`));
            }
          },
        );
      });
    });
  });

  describe("configuration mapping", () => {
    it("should correctly map Vite aliases to enhanced-resolve format", () => {
      const mockConfig = {
        root: mockProjectRoot,
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
        root: mockProjectRoot,
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
        root: mockProjectRoot,
        environments: {
          worker: {
            resolve: {
              conditions: ["node", "import"],
              mainFields: ["module", "main"],
              extensions: [".js", ".ts"],
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
      expect(options.extensions).toEqual([".js", ".ts"]);
      expect(options.symlinks).toBe(true);
    });

    it("should merge root and environment aliases correctly", () => {
      const mockConfig = {
        root: mockProjectRoot,
        resolve: {
          alias: {
            global: "/global/path",
          },
        },
        environments: {
          worker: {
            resolve: {
              alias: {
                "@": "/src",
                global: "/overridden/path", // Should override root alias
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
        global: "/overridden/path", // Environment alias should win
        "@": "/src",
      });
    });
  });
});
