import { getPluginApi } from "@vitejs/plugin-rsc/plugin";
import debug from "debug";
import type { Plugin, ResolvedConfig, ViteDevServer } from "vite";
import { normalizePath } from "vite";
import { VENDOR_SERVER_BARREL_EXPORT_PATH } from "../lib/constants.mjs";

const VIRTUAL_MODULE = "virtual:use-server-lookup.js";
const RESOLVED_VIRTUAL_MODULE = "\0rwsdk:vite-rsc-use-server-lookup";
const ENCODED_RESOLVED_VIRTUAL_MODULE = "__x00__rwsdk:vite-rsc-use-server-lookup";

type ServerReferenceMeta = {
  importId: string;
  referenceKey: string;
  exportNames?: string[];
};

type ServerReferenceMetaMap = Record<string, ServerReferenceMeta>;

const log = debug("rwsdk:vite:vite-rsc-server-reference-lookup");
const persistedServerReferenceMetaMaps = new Map<string, ServerReferenceMetaMap>();

const normalizeReferenceId = (id: string) =>
  normalizePath(id.replace(/\\/g, "/")).replace(/^[A-Z]:\//, (drive) =>
    drive.toLowerCase(),
  );

const stripViteTimestampQuery = (id: string) => {
  const hashIndex = id.indexOf("#");
  const pathPart = hashIndex === -1 ? id : id.slice(0, hashIndex);
  const exportPart = hashIndex === -1 ? "" : id.slice(hashIndex);
  return pathPart.split("?", 1)[0] + exportPart;
};

export const generateViteRscServerReferenceLookupCode = ({
  isDev = false,
  projectRootDir,
  serverFiles,
  serverReferenceMetaMap,
}: {
  isDev?: boolean;
  projectRootDir: string;
  serverFiles?: Iterable<string>;
  serverReferenceMetaMap: ServerReferenceMetaMap;
}) => {
  const entries = new Map<string, string>();
  const normalizedRoot = normalizeReferenceId(projectRootDir).replace(/\/$/, "");

  const add = (key: string | undefined, importId: string | undefined) => {
    if (!key || !importId) {
      return;
    }

    const normalizedKey = normalizeReferenceId(key);
    const normalizedImportId = normalizeReferenceId(importId);
    for (const keyVariant of new Set([
      normalizedKey,
      stripViteTimestampQuery(normalizedKey),
    ])) {
      if (!entries.has(keyVariant)) {
        entries.set(keyVariant, normalizedImportId);
      }
    }
  };

  const rootRelative = (id: string) => {
    const normalizedId = normalizeReferenceId(id);
    if (normalizedId.startsWith(`${normalizedRoot}/`)) {
      return normalizedId.slice(normalizedRoot.length + 1);
    }
    return normalizedId;
  };

  for (const file of serverFiles ?? []) {
    add(file, file);
  }

  for (const [id, meta] of Object.entries(serverReferenceMetaMap)) {
    const importId = normalizeReferenceId(meta.importId);
    const sourceId = normalizeReferenceId(id);
    const rootRelativeSourceId = rootRelative(sourceId);

    add(importId, importId);
    add(meta.referenceKey, importId);
    add(sourceId, importId);
    add(rootRelativeSourceId, importId);
    add(`/${rootRelativeSourceId}`, importId);

    for (const exportName of meta.exportNames ?? []) {
      add(`${meta.referenceKey}#${exportName}`, importId);
      add(`${importId}#${exportName}`, importId);
      add(`${rootRelativeSourceId}#${exportName}`, importId);
      add(`/${rootRelativeSourceId}#${exportName}`, importId);
    }
  }

  const lines = Array.from(entries.entries()).map(([key, importId]) => {
    if (isDev && importId.includes("node_modules")) {
      return `  ${JSON.stringify(key)}: () => import(${JSON.stringify(
        VENDOR_SERVER_BARREL_EXPORT_PATH,
      )}).then(m => m.default[${JSON.stringify(importId)}]),`;
    }

    return `  ${JSON.stringify(key)}: () => import(${JSON.stringify(importId)}),`;
  });

  return `export const useServerLookup = {\n${lines.join("\n")}\n};\n`;
};

export const viteRscServerReferenceLookupPlugin = ({
  projectRootDir,
  serverFiles,
}: {
  projectRootDir: string;
  serverFiles?: Set<string>;
}): Plugin => {
  let config: ResolvedConfig;
  let devServer: ViteDevServer | undefined;

  const liveServerReferenceMetaMap = () =>
    (getPluginApi(config)?.manager.serverReferenceMetaMap ?? {}) as ServerReferenceMetaMap;

  const currentServerReferenceMetaMap = () => {
    const live = liveServerReferenceMetaMap();
    return Object.keys(live).length > 0
      ? live
      : (persistedServerReferenceMetaMaps.get(projectRootDir) ?? {});
  };

  const persistIfPresent = () => {
    const live = liveServerReferenceMetaMap();
    if (Object.keys(live).length > 0) {
      const snapshot = { ...live };
      persistedServerReferenceMetaMaps.set(projectRootDir, snapshot);
      log("persisted %d server reference metadata records", Object.keys(snapshot).length);
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
    name: "rwsdk:vite-rsc-server-reference-lookup",
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
        name: "rwsdk:vite-rsc-server-reference-lookup",
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
      const serverReferenceMetaMap = currentServerReferenceMetaMap();
      log(
        "loading use-server lookup for %s with %d server reference metadata records and %d directive server files",
        this.environment?.name ?? "unknown",
        Object.keys(serverReferenceMetaMap).length,
        serverFiles?.size ?? 0,
      );

      return generateViteRscServerReferenceLookupCode({
        isDev: config.command === "serve",
        projectRootDir,
        serverFiles,
        serverReferenceMetaMap,
      });
    },
    transform: {
      order: "post",
      handler(code) {
        if (
          this.environment?.name === "worker" &&
          code.includes("registerServerReference")
        ) {
          persistIfPresent();
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
