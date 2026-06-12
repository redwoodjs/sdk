import { describe, expect, it } from "vitest";
import {
  createClientManifestFromViteRsc,
  createModuleMapFromViteRsc,
  type ViteRscClientReferenceMetaMap,
} from "./viteRscManifestAdapter";

const clientReferenceMetaMap: ViteRscClientReferenceMetaMap = {
  "/repo/app/src/app/client/DefaultOnly.tsx": {
    importId: "/repo/app/src/app/client/DefaultOnly.tsx",
    referenceKey: "defaultRef",
    exportNames: ["default"],
  },
  "/repo/app/src/app/client/Mixed.tsx": {
    importId: "/repo/app/src/app/client/Mixed.tsx",
    referenceKey: "mixedRef",
    exportNames: ["default", "MixedNamed"],
  },
  "/repo/app/src/app/client/DynamicTarget.tsx": {
    importId: "/repo/app/src/app/client/DynamicTarget.tsx",
    referenceKey: "dynamicRef",
    exportNames: ["default"],
  },
  "/repo/app/src/app/client/duplicate/a/Duplicate.tsx": {
    importId: "/repo/app/src/app/client/duplicate/a/Duplicate.tsx",
    referenceKey: "duplicateARef",
    exportNames: ["Duplicate"],
  },
  "/repo/app/src/app/client/duplicate/b/Duplicate.tsx": {
    importId: "/repo/app/src/app/client/duplicate/b/Duplicate.tsx",
    referenceKey: "duplicateBRef",
    exportNames: ["Duplicate"],
  },
  "/repo/app/src/app/client/ReExportLeaf.tsx": {
    importId: "/repo/app/src/app/client/ReExportLeaf.tsx",
    referenceKey: "reExportRef",
    exportNames: ["ReExportedButton"],
  },
  "/repo/app/src/app/client/Named.tsx?t=123": {
    importId: "/repo/app/src/app/client/Named.tsx?t=123",
    referenceKey: "namedRef",
    exportNames: ["NamedButton", "NamedLabel"],
  },
};

describe("vite-rsc manifest/module-map adapters", () => {
  it("creates Redwood client manifest entries from plugin-rsc reference keys and path aliases", () => {
    const manifest = createClientManifestFromViteRsc({
      clientReferenceMetaMap,
      projectRootDir: "/repo/app",
    }) as any;

    expect(manifest["defaultRef#default"]).toEqual({
      id: "defaultRef",
      name: "default",
      chunks: [],
      async: true,
    });
    expect(manifest["/src/app/client/Mixed.tsx#MixedNamed"]).toEqual({
      id: "mixedRef",
      name: "MixedNamed",
      chunks: [],
      async: true,
    });
    expect(manifest["src/app/client/DynamicTarget.tsx#default"]).toEqual({
      id: "dynamicRef",
      name: "default",
      chunks: [],
      async: true,
    });
  });

  it("keeps duplicate basenames distinct and resolves re-export leaf metadata", () => {
    const manifest = createClientManifestFromViteRsc({
      clientReferenceMetaMap,
      projectRootDir: "/repo/app",
    }) as any;

    expect(manifest["src/app/client/duplicate/a/Duplicate.tsx#Duplicate"]).toEqual({
      id: "duplicateARef",
      name: "Duplicate",
      chunks: [],
      async: true,
    });
    expect(manifest["src/app/client/duplicate/b/Duplicate.tsx#Duplicate"]).toEqual({
      id: "duplicateBRef",
      name: "Duplicate",
      chunks: [],
      async: true,
    });
    expect(manifest["/src/app/client/ReExportLeaf.tsx#ReExportedButton"]).toEqual({
      id: "reExportRef",
      name: "ReExportedButton",
      chunks: [],
      async: true,
    });
  });

  it("preserves Redwood proxy fallback behavior for unknown client and server reference ids", () => {
    const manifest = createClientManifestFromViteRsc({
      clientReferenceMetaMap,
      projectRootDir: "/repo/app",
    }) as any;

    expect(manifest["/src/app/unknown.tsx#Missing"]).toEqual({
      id: "/src/app/unknown.tsx",
      name: "Missing",
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

  it("can opt into plugin-rsc asset deps while defaulting to chunkless Redwood entries", () => {
    const chunkless = createClientManifestFromViteRsc({
      clientReferenceMetaMap,
      clientReferenceDeps: {
        mixedRef: { js: ["/assets/Mixed.js"], css: ["/assets/Mixed.css"] },
      },
      projectRootDir: "/repo/app",
    }) as any;
    const withChunks = createClientManifestFromViteRsc({
      clientReferenceMetaMap,
      clientReferenceDeps: {
        mixedRef: { js: ["/assets/Mixed.js"], css: ["/assets/Mixed.css"] },
      },
      projectRootDir: "/repo/app",
      useAssetChunks: true,
    }) as any;

    expect(chunkless["mixedRef#MixedNamed"].chunks).toEqual([]);
    expect(withChunks["mixedRef#MixedNamed"].chunks).toEqual([
      "/assets/Mixed.js",
      "/assets/Mixed.css",
    ]);
  });

  it("resolves Vite HMR timestamp aliases in client manifests and module maps", () => {
    const manifest = createClientManifestFromViteRsc({
      clientReferenceMetaMap,
      projectRootDir: "/repo/app",
    }) as any;
    const moduleMap = createModuleMapFromViteRsc({
      clientReferenceMetaMap,
      projectRootDir: "/repo/app",
    }) as any;

    expect(manifest["/src/app/client/Named.tsx#NamedButton"]).toEqual({
      id: "namedRef",
      name: "NamedButton",
      chunks: [],
      async: true,
    });
    expect(moduleMap["/src/app/client/Named.tsx"].NamedLabel).toEqual({
      id: "namedRef",
      name: "NamedLabel",
      chunks: [],
      async: true,
    });
  });

  it("creates Redwood module-map entries from plugin-rsc metadata and preserves fallback", () => {
    const moduleMap = createModuleMapFromViteRsc({
      clientReferenceMetaMap,
      projectRootDir: "/repo/app",
    }) as any;

    expect(moduleMap["/src/app/client/Mixed.tsx"].MixedNamed).toEqual({
      id: "mixedRef",
      name: "MixedNamed",
      chunks: [],
      async: true,
    });
    expect(moduleMap["/src/app/client/duplicate/a/Duplicate.tsx"].Duplicate).toEqual({
      id: "duplicateARef",
      name: "Duplicate",
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
