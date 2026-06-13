import { afterEach, describe, expect, it } from "vitest";
import { createNullSsrModule } from "../imports/nullSsrModule";
import { createClientManifest } from "./createClientManifest";

const clearViteRscManifestData = () => {
  delete (globalThis as any).__RWSDK_VITE_RSC_MANIFEST_DATA__;
};

describe("createClientManifest", () => {
  afterEach(clearViteRscManifestData);
  it("splits transition ids containing an export name for plugin-rsc references", () => {
    const manifest = createClientManifest() as any;

    expect(manifest["abc123#NamedButton"]).toEqual({
      id: "abc123",
      name: "NamedButton",
      chunks: [],
      async: true,
    });
  });

  it("keeps bare ids resolvable as async module references", () => {
    const manifest = createClientManifest() as any;

    expect(manifest["abc123"]).toEqual({
      id: "abc123",
      name: "abc123",
      chunks: [],
      async: true,
    });
  });

  it("keeps ssr:false null modules compatible with split manifest id/name entries", () => {
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

    const manifest = createClientManifest() as any;
    const entry = manifest["hashNamed#NamedButton"];
    const ssrFalseModule = createNullSsrModule() as any;

    expect(entry).toEqual({
      id: "hashNamed",
      name: "NamedButton",
      chunks: [],
      async: true,
    });
    expect(ssrFalseModule[entry.name]()).toBe(null);
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

    const manifest = createClientManifest() as any;

    expect(manifest["src/app/client/Named.tsx#NamedButton"]).toEqual({
      id: "hashNamed",
      name: "NamedButton",
      chunks: [],
      async: true,
    });
    expect(manifest["/src/app/actions.ts#getGreeting"]).toEqual({
      id: "/src/app/actions.ts",
      name: "getGreeting",
      chunks: [],
      async: true,
    });
  });
});
