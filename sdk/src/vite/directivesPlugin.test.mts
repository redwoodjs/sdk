import { describe, expect, it } from "vitest";
import { directivesPlugin, getLoader } from "./directivesPlugin.mjs";

const makeConfig = () => ({
  optimizeDeps: {} as any,
});

describe("directivesPlugin", () => {
  describe("getLoader", () => {
    const testCases = [
      { path: "file.js", expected: "js" },
      { path: "file.mjs", expected: "js" },
      { path: "file.cjs", expected: "js" },
      { path: "file.ts", expected: "ts" },
      { path: "file.mts", expected: "ts" },
      { path: "file.cts", expected: "ts" },
      { path: "file.jsx", expected: "jsx" },
      { path: "file.tsx", expected: "tsx" },
      { path: "/path/to/component.ts", expected: "ts" },
      { path: "../relative/path.jsx", expected: "jsx" },
      { path: "file.css", expected: "js" }, // default case
      { path: "file.json", expected: "js" }, // default case
      { path: "file", expected: "js" }, // no extension
    ];

    testCases.forEach(({ path, expected }) => {
      it(`should return "${expected}" for "${path}"`, () => {
        expect(getLoader(path)).toBe(expected);
      });
    });
  });

  describe("configEnvironment", () => {
    it("registers the directive transform optimizer plugin for SDK environments", () => {
      const plugin = directivesPlugin({
        projectRootDir: "/Users/test/project",
        clientFiles: new Set(),
        serverFiles: new Set(),
      });

      for (const envName of ["client", "ssr", "worker"]) {
        const config = makeConfig();
        (plugin as any).configEnvironment(envName, config);
        expect(config.optimizeDeps.rolldownOptions?.plugins).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ name: "rsc-directives-transform" }),
          ]),
        );
      }
    });

    it("does not register the directive transform for non-SDK environments", () => {
      const plugin = directivesPlugin({
        projectRootDir: "/Users/test/project",
        clientFiles: new Set(),
        serverFiles: new Set(),
      });

      for (const envName of ["aux_email_worker", "custom"]) {
        const config = makeConfig();
        (plugin as any).configEnvironment(envName, config);
        expect(config.optimizeDeps.rolldownOptions?.plugins).toBeUndefined();
      }
    });
  });
});
