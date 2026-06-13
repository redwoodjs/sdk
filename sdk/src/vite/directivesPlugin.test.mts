import { describe, expect, it } from "vitest";
import { getLoader, pluginRscMetaMapHasModule } from "./directivesPlugin.mjs";

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

describe("pluginRscMetaMapHasModule", () => {
  it("matches plugin-rsc metadata by source or import id", () => {
    expect(
      pluginRscMetaMapHasModule({
        projectRootDir: "/repo/app",
        id: "/repo/app/src/app/Client.tsx?t=123",
        metaMap: {
          "/repo/app/src/app/Client.tsx": {
            importId: "/repo/app/src/app/Client.tsx?t=456",
            referenceKey: "abc123",
          },
        },
      }),
    ).toBe(true);
  });

  it("does not match source text that merely mentions plugin-rsc helper names", () => {
    expect(
      pluginRscMetaMapHasModule({
        projectRootDir: "/repo/app",
        id: "/repo/app/src/app/mentions-registerClientReference.ts",
        metaMap: {},
      }),
    ).toBe(false);
  });
});
