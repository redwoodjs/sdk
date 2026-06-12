import { describe, expect, it } from "vitest";
import { generateViteRscManifestDataCode } from "./viteRscManifestDataPlugin.mjs";

describe("generateViteRscManifestDataCode", () => {
  it("serializes plugin-rsc manifest metadata into a runtime global assignment", () => {
    const code = generateViteRscManifestDataCode({
      projectRootDir: "/repo/app",
      useAssetChunks: false,
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
    expect(code).toContain('"useAssetChunks":false');
    expect(code).toContain(
      "export default globalThis.__RWSDK_VITE_RSC_MANIFEST_DATA__",
    );
  });
});
