import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DIST_DIR,
  VENDOR_CLIENT_BARREL_PATH,
  VENDOR_SERVER_BARREL_PATH,
} from "../lib/constants.mjs";
import { createBuildPaths } from "./buildPaths.mjs";

describe("createBuildPaths", () => {
  it("gives each application its own intermediate build workspace", () => {
    const appA = resolve("workspace", "apps", "app-a");
    const appB = resolve("workspace", "apps", "app-b");

    const pathsA = createBuildPaths(appA);
    const pathsB = createBuildPaths(appB);

    expect(pathsA.intermediatesDir).toBe(
      resolve(appA, "node_modules", ".cache", "rwsdk", "__intermediate_builds"),
    );
    expect(pathsB.intermediatesDir).toBe(
      resolve(appB, "node_modules", ".cache", "rwsdk", "__intermediate_builds"),
    );
    expect(pathsA.intermediatesDir).not.toBe(pathsB.intermediatesDir);
    expect(pathsA.tempEntryPath).toBe(
      resolve(pathsA.intermediatesDir, "temp-entry.js"),
    );
    expect(pathsA.directiveScanOutDir).toBe(
      resolve(pathsA.intermediatesDir, "directive-scan"),
    );
    expect(pathsA.ssrBridgePath).toBe(
      resolve(pathsA.intermediatesDir, "ssr", "ssr_bridge.js"),
    );
  });

  it("keeps package-export markers in the SDK distribution", () => {
    expect(VENDOR_CLIENT_BARREL_PATH).toBe(
      resolve(
        DIST_DIR,
        "__intermediate_builds",
        "__vendor_client_barrel.dev-virtual.js",
      ),
    );
    expect(VENDOR_SERVER_BARREL_PATH).toBe(
      resolve(
        DIST_DIR,
        "__intermediate_builds",
        "__vendor_server_barrel.dev-virtual.js",
      ),
    );
  });
});
