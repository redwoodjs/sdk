import { describe, expect, it } from "vitest";
import {
  VENDOR_CLIENT_BARREL_EXPORT_PATH,
  VENDOR_SERVER_BARREL_EXPORT_PATH,
} from "../lib/constants.mjs";
import { generateLookupMap } from "./createDirectiveLookupPlugin.mjs";

describe("generateLookupMap", () => {
  const files = new Set([
    "src/app.js",
    "node_modules/lib-a/index.js",
    "src/component.tsx",
  ]);

  it.each(["client", "server"] as const)(
    "should generate the same %s lookup without mutating insertion order",
    (kind) => {
      const forwardFiles = new Set(files);
      const reverseFiles = new Set([...files].reverse());
      const forwardOrder = [...forwardFiles];
      const reverseOrder = [...reverseFiles];

      const forwardResult = generateLookupMap({
        files: forwardFiles,
        isDev: true,
        kind,
        exportName: `${kind}Lookup`,
      });
      const reverseResult = generateLookupMap({
        files: reverseFiles,
        isDev: true,
        kind,
        exportName: `${kind}Lookup`,
      });

      expect(forwardResult.code).toBe(reverseResult.code);
      expect([...forwardFiles]).toEqual(forwardOrder);
      expect([...reverseFiles]).toEqual(reverseOrder);
    },
  );

  it("should generate correct map for client in dev", () => {
    const result = generateLookupMap({
      files,
      isDev: true,
      kind: "client",
      exportName: "clientLookup",
    });

    expect(result.code).toContain("export const clientLookup = {");
    expect(result.code).toContain(`"src/app.js": () => import("src/app.js")`);
    expect(result.code).toContain(
      `"node_modules/lib-a/index.js": () => import("${VENDOR_CLIENT_BARREL_EXPORT_PATH}").then(m => m.default["node_modules/lib-a/index.js"])`,
    );
  });

  it("should generate correct map for server in dev", () => {
    const result = generateLookupMap({
      files,
      isDev: true,
      kind: "server",
      exportName: "serverLookup",
    });

    expect(result.code).toContain("export const serverLookup = {");
    expect(result.code).toContain(
      `"node_modules/lib-a/index.js": () => import("${VENDOR_SERVER_BARREL_EXPORT_PATH}").then(m => m.default["node_modules/lib-a/index.js"])`,
    );
  });

  it("should generate correct map for prod (isDev: false)", () => {
    const result = generateLookupMap({
      files,
      isDev: false,
      kind: "client",
      exportName: "clientLookup",
    });

    expect(result.code).toContain(
      `"node_modules/lib-a/index.js": () => import("node_modules/lib-a/index.js")`,
    );
  });

  it("should source-serve files under optimizeDeps.exclude roots in dev", () => {
    const result = generateLookupMap({
      files,
      isDev: true,
      kind: "client",
      exportName: "clientLookup",
      optimizeDepsExclude: ["/project/node_modules/lib-a"],
      projectRootDir: "/project",
    });

    expect(result.code).toContain(
      `"node_modules/lib-a/index.js": () => import("node_modules/lib-a/index.js")`,
    );
    expect(result.code).not.toContain(
      `"node_modules/lib-a/index.js": () => import("${VENDOR_CLIENT_BARREL_EXPORT_PATH}")`,
    );
  });
});
