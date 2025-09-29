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
});
