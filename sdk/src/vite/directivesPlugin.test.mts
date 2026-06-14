import { describe, expect, it } from "vitest";
import {
  getLoader,
  pluginRscMetaMapHasModule,
  shouldSkipLegacyClientTransformForPluginRsc,
} from "./directivesPlugin.mjs";

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

describe("shouldSkipLegacyClientTransformForPluginRsc", () => {
  it("skips Redwood's legacy worker transform for known client files before plugin-rsc metadata is populated", () => {
    expect(
      shouldSkipLegacyClientTransformForPluginRsc({
        experimentalUseViteRscClientReferences: true,
        environmentName: "worker",
        clientFiles: new Set(["/src/app/Client.tsx"]),
        normalizedId: "/src/app/Client.tsx",
        pluginRscClientReferenceMetaMap: {},
        projectRootDir: "/repo/app",
        rawId: "/repo/app/src/app/Client.tsx",
      }),
    ).toBe(true);
  });

  it("keeps the legacy transform outside plugin-rsc worker client-reference mode", () => {
    expect(
      shouldSkipLegacyClientTransformForPluginRsc({
        experimentalUseViteRscClientReferences: false,
        environmentName: "worker",
        clientFiles: new Set(["/src/app/Client.tsx"]),
        normalizedId: "/src/app/Client.tsx",
        pluginRscClientReferenceMetaMap: {},
        projectRootDir: "/repo/app",
        rawId: "/repo/app/src/app/Client.tsx",
      }),
    ).toBe(false);
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
