import { afterEach, describe, expect, it } from "vitest";
import { createModuleMap } from "./createModuleMap";

const clearViteRscManifestData = () => {
  delete (globalThis as any).__RWSDK_VITE_RSC_MANIFEST_DATA__;
};

describe("createModuleMap", () => {
  afterEach(clearViteRscManifestData);
  it("returns async module map entries for split id/name client references", () => {
    const moduleMap = createModuleMap() as any;

    expect(moduleMap["abc123"].NamedButton).toEqual({
      id: "abc123",
      name: "NamedButton",
      chunks: [],
      async: true,
    });
  });

  it("uses vite-rsc manifest data when the experimental runtime bridge provides it", () => {
    (globalThis as any).__RWSDK_VITE_RSC_MANIFEST_DATA__ = {
      projectRootDir: "/repo/app",
      clientReferenceMetaMap: {
        "/repo/app/src/app/client/Named.tsx": {
          importId: "/repo/app/src/app/client/Named.tsx",
          referenceKey: "hashNamed",
          exportNames: ["NamedButton"],
        },
      },
    };

    const moduleMap = createModuleMap() as any;

    expect(moduleMap["src/app/client/Named.tsx"].NamedButton).toEqual({
      id: "hashNamed",
      name: "NamedButton",
      chunks: [],
      async: true,
    });
    expect(moduleMap["/src/app/actions.ts"].getGreeting).toEqual({
      id: "/src/app/actions.ts",
      name: "getGreeting",
      chunks: [],
      async: true,
    });
  });
});
