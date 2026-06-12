import { getPluginApi } from "@vitejs/plugin-rsc/plugin";
import debug from "debug";
import type { Plugin, ResolvedConfig, ViteDevServer } from "vite";
import type { ViteRscClientReferenceMeta } from "./viteRscClientReferenceAdapter.mjs";

const VIRTUAL_MODULE = "virtual:rwsdk-vite-rsc-manifest-data.js";
const RESOLVED_VIRTUAL_MODULE = "\0rwsdk:vite-rsc-manifest-data";
const ENCODED_RESOLVED_VIRTUAL_MODULE = "__x00__rwsdk:vite-rsc-manifest-data";

type ClientReferenceMetaMap = Record<string, ViteRscClientReferenceMeta>;

type ManifestData = {
  clientReferenceMetaMap: ClientReferenceMetaMap;
  projectRootDir: string;
  useAssetChunks: false;
};

const log = debug("rwsdk:vite:vite-rsc-manifest-data");
const persistedClientReferenceMetaMaps = new Map<string, ClientReferenceMetaMap>();

const runtimeManifestFiles = [
  "/runtime/render/createClientManifest.",
  "/runtime/render/createModuleMap.",
];

const normalizeId = (id: string) => id.replace(/\\/g, "/");

const isRuntimeManifestFile = (id: string) => {
  const normalized = normalizeId(id);
  return runtimeManifestFiles.some((needle) => normalized.includes(needle));
};

export const generateViteRscManifestDataCode = (
  data: ManifestData,
  { exportDefault = true }: { exportDefault?: boolean } = {},
) => `
globalThis.__RWSDK_VITE_RSC_MANIFEST_DATA__ = ${JSON.stringify(data)};
${exportDefault ? "export default globalThis.__RWSDK_VITE_RSC_MANIFEST_DATA__;" : ""}
`;

export const viteRscManifestDataPlugin = ({
  projectRootDir,
}: {
  projectRootDir: string;
}): Plugin => {
  let config: ResolvedConfig;
  let devServer: ViteDevServer | undefined;
  let isBuild = false;

  const liveClientReferenceMetaMap = () =>
    (getPluginApi(config)?.manager.clientReferenceMetaMap ?? {}) as ClientReferenceMetaMap;

  const currentClientReferenceMetaMap = () => {
    const live = liveClientReferenceMetaMap();
    return Object.keys(live).length > 0
      ? live
      : (persistedClientReferenceMetaMaps.get(projectRootDir) ?? {});
  };

  const persistIfPresent = () => {
    const live = liveClientReferenceMetaMap();
    if (Object.keys(live).length > 0) {
      const snapshot = { ...live };
      persistedClientReferenceMetaMaps.set(projectRootDir, snapshot);
      log("persisted %d manifest metadata records", Object.keys(snapshot).length);
    }
  };

  const manifestData = (): ManifestData => {
    persistIfPresent();
    return {
      clientReferenceMetaMap: currentClientReferenceMetaMap(),
      projectRootDir,
      // Keep Redwood's existing chunks: [] behavior for the first wired step.
      useAssetChunks: false,
    };
  };

  const manifestAssignment = () => generateViteRscManifestDataCode(manifestData());

  const invalidateVirtualModule = () => {
    if (!devServer) {
      return;
    }

    const module =
      devServer.moduleGraph.getModuleById(RESOLVED_VIRTUAL_MODULE) ??
      devServer.moduleGraph.getModuleById(VIRTUAL_MODULE);

    if (module) {
      devServer.moduleGraph.invalidateModule(module);
      log("invalidated %s", RESOLVED_VIRTUAL_MODULE);
    }
  };

  return {
    name: "rwsdk:vite-rsc-manifest-data",
    config(_config, { command }) {
      isBuild = command === "build";
    },
    configResolved(resolvedConfig) {
      config = resolvedConfig;
    },
    configureServer(server) {
      devServer = server;
    },
    resolveId(source) {
      if (source === VIRTUAL_MODULE || source === ENCODED_RESOLVED_VIRTUAL_MODULE) {
        return RESOLVED_VIRTUAL_MODULE;
      }

      return null;
    },
    load(id) {
      if (id !== RESOLVED_VIRTUAL_MODULE && id !== ENCODED_RESOLVED_VIRTUAL_MODULE) {
        return null;
      }

      return manifestAssignment();
    },
    transform(code, id) {
      if (!isBuild || !isRuntimeManifestFile(id)) {
        return null;
      }

      persistIfPresent();
      return `import ${JSON.stringify(VIRTUAL_MODULE)};\n${code}`;
    },
    renderChunk(code) {
      if (!["worker", "ssr"].includes(this.environment?.name ?? "")) {
        return null;
      }

      const data = manifestData();
      if (Object.keys(data.clientReferenceMetaMap).length === 0) {
        return null;
      }

      return {
        code: `${generateViteRscManifestDataCode(data, { exportDefault: false })}\n${code}`,
        map: null,
      };
    },
    generateBundle() {
      persistIfPresent();
    },
    handleHotUpdate(ctx) {
      if (ctx.modules.some((module) => module.id && currentClientReferenceMetaMap()[module.id])) {
        persistIfPresent();
        invalidateVirtualModule();
      }
    },
  };
};
