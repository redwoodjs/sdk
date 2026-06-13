import { getPluginApi } from "@vitejs/plugin-rsc/plugin";
import debug from "debug";
import type { Plugin, ResolvedConfig, ViteDevServer } from "vite";
import { VENDOR_CLIENT_BARREL_EXPORT_PATH } from "../lib/constants.mjs";
import {
  generateViteRscClientReferenceLookupEntries,
  type ViteRscClientReferenceMeta,
} from "./viteRscClientReferenceAdapter.mjs";

export const VIRTUAL_MODULE = "virtual:use-client-lookup.js";
export const RESOLVED_VIRTUAL_MODULE = "\0rwsdk:vite-rsc-use-client-lookup";
const ENCODED_RESOLVED_VIRTUAL_MODULE = "__x00__rwsdk:vite-rsc-use-client-lookup";

type ClientReferenceMetaMap = Record<string, ViteRscClientReferenceMeta>;

const log = debug("rwsdk:vite:vite-rsc-client-reference");
const persistedClientReferenceMetaMaps = new Map<string, ClientReferenceMetaMap>();

export const generateViteRscClientReferenceLookupCode = ({
  clientReferenceMetaMap,
  legacyClientFiles,
  projectRootDir,
  isDev = false,
}: {
  clientReferenceMetaMap: ClientReferenceMetaMap;
  legacyClientFiles?: Iterable<string>;
  projectRootDir: string;
  isDev?: boolean;
}) => {
  const entries = generateViteRscClientReferenceLookupEntries({
    clientReferenceMetaMap,
    legacyClientFiles,
    projectRootDir,
  });
  const lines = entries.map(({ key, importId }) => {
    if (isDev && importId.includes("node_modules")) {
      return `  ${JSON.stringify(key)}: () => import(${JSON.stringify(
        VENDOR_CLIENT_BARREL_EXPORT_PATH,
      )}).then(m => m.default[${JSON.stringify(importId)}]),`;
    }

    return `  ${JSON.stringify(key)}: () => import(${JSON.stringify(importId)}),`;
  });

  return `export const useClientLookup = {\n${lines.join("\n")}\n};\n`;
};

export const viteRscClientReferencePlugin = ({
  clientFiles,
  projectRootDir,
}: {
  clientFiles?: Set<string>;
  projectRootDir: string;
}): Plugin => {
  let config: ResolvedConfig;
  let devServer: ViteDevServer | undefined;

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
      log(
        "persisted %d client reference metadata records",
        Object.keys(snapshot).length,
      );
    }
  };

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
    name: "rwsdk:vite-rsc-client-reference-lookup",
    configResolved(resolvedConfig) {
      config = resolvedConfig;
    },
    configureServer(server) {
      devServer = server;
    },
    configEnvironment(_env, viteConfig) {
      viteConfig.optimizeDeps ??= {};
      viteConfig.optimizeDeps.esbuildOptions ??= {};
      viteConfig.optimizeDeps.esbuildOptions.plugins ??= [];
      viteConfig.optimizeDeps.esbuildOptions.plugins.push({
        name: "rwsdk:vite-rsc-client-reference-lookup",
        setup(build) {
          const escapedVirtualModule = VIRTUAL_MODULE.replace(
            /[-\/\\^$*+?.()|[\]{}]/g,
            "\\$&",
          );
          const escapedPrefixedVirtualModule = `/@id/${VIRTUAL_MODULE}`.replace(
            /[-\/\\^$*+?.()|[\]{}]/g,
            "\\$&",
          );

          build.onResolve(
            {
              filter: new RegExp(
                `^(${escapedVirtualModule}|${escapedPrefixedVirtualModule})$`,
              ),
            },
            () => ({
              path: VIRTUAL_MODULE,
              external: true,
            }),
          );
        },
      });
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

      persistIfPresent();
      const clientReferenceMetaMap = currentClientReferenceMetaMap();
      log(
        "loading use-client lookup for %s with %d client reference metadata records and %d directive client files",
        this.environment?.name ?? "unknown",
        Object.keys(clientReferenceMetaMap).length,
        clientFiles?.size ?? 0,
      );

      return generateViteRscClientReferenceLookupCode({
        clientReferenceMetaMap,
        legacyClientFiles: clientFiles,
        projectRootDir,
        isDev: config.command === "serve",
      });
    },
    transform: {
      order: "post",
      handler(code, id) {
        if (
          this.environment?.name === "worker" &&
          code.includes("registerClientReference")
        ) {
          persistIfPresent();
          const meta = currentClientReferenceMetaMap()[id];
          if (meta) {
            log("metadata for %s exports: %o", id, meta.exportNames);
          }
          invalidateVirtualModule();
        }
      },
    },
    generateBundle() {
      if (this.environment?.name === "worker") {
        persistIfPresent();
      }
    },
  };
};
