import { describe, expect, it } from "vitest";
import {
  generateViteRscManifestDataCode,
  isRuntimeManifestFile,
} from "./viteRscManifestDataPlugin.mjs";

describe("generateViteRscManifestDataCode", () => {
  it("serializes plugin-rsc manifest metadata into a runtime global assignment", () => {
    const code = generateViteRscManifestDataCode({
      projectRootDir: "/repo/app",
      clientReferenceMetaMap: {
        "/repo/app/src/app/client/Named.tsx": {
          importId: "/repo/app/src/app/client/Named.tsx",
          referenceKey: "hashNamed",
          exportNames: ["NamedButton"],
        },
      },
    });

    expect(code).toContain("globalThis.__RWSDK_VITE_RSC_MANIFEST_DATA__");
    expect(code).toContain('"projectRootDir":"/repo/app"');
    expect(code).toContain('"referenceKey":"hashNamed"');
    expect(code).toContain(
      "export default globalThis.__RWSDK_VITE_RSC_MANIFEST_DATA__",
    );
  });

  it("detects runtime manifest files by exact suffix, not arbitrary substrings", () => {
    expect(
      isRuntimeManifestFile(
        "/repo/app/node_modules/rwsdk/runtime/render/createClientManifest.js?t=123",
      ),
    ).toBe(true);
    expect(
      isRuntimeManifestFile(
        "/repo/app/virtual/createClientManifest.js.fake/runtime/render/not-it.js",
      ),
    ).toBe(false);
    expect(
      isRuntimeManifestFile(
        "virtual:third-party/runtime/render/createClientManifest.js.extra",
      ),
    ).toBe(false);
  });
});
