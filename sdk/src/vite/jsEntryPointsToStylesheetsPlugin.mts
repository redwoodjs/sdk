import path from "node:path";
import fs from "node:fs/promises";

import type {
  Plugin,
  ViteDevServer,
  ResolvedConfig,
  EnvironmentModuleNode,
  ModuleNode,
} from "vite";
import { normalizeModulePath } from "../lib/normalizeModulePath.mjs";

let devServer: ViteDevServer | undefined;
let config: ResolvedConfig;
let manifest: Record<string, { file: string; css?: string[] }> | undefined;

const jsEntryPointToStylesheetsCache = new Map<string, string[]>();

const isStylesheet = (file: string) =>
  /\.(css|scss|sass|less|styl|stylus)($|\?)/.test(file);

const collectStylesheetsForJsEntryPoint = async (
  entryPointUrl: string,
  server: ViteDevServer,
): Promise<string[]> => {
  const styles = new Set<string>();
  const entryModule =
    await server.environments.client.moduleGraph.getModuleByUrl(entryPointUrl);

  if (!entryModule) {
    console.warn(
      `[stylesLookupPlugin] Could not find module for entry point: ${entryPointUrl}`,
    );
    return [];
  }

  const queue: EnvironmentModuleNode[] = [entryModule];
  const visited = new Set<string>([entryModule.id!]);

  while (queue.length > 0) {
    const mod = queue.shift()!;

    if (mod.file && isStylesheet(mod.file)) {
      styles.add(mod.file);
    }

    for (const imported of mod.importedModules) {
      if (imported.id && !visited.has(imported.id)) {
        visited.add(imported.id);
        queue.push(imported);
      }
    }
  }

  return Array.from(styles);
};

const readManifest = async (
  manifestPath: string,
): Promise<Record<string, { file: string; css?: string[] }>> => {
  if (manifest === undefined) {
    try {
      manifest = JSON.parse(await fs.readFile(manifestPath, "utf-8"));
    } catch (e) {
      console.error(
        `RedwoodSDK: Could not read client manifest at ${manifestPath}. This is likely a bug.`,
        e,
      );
      manifest = {};
    }
  }

  return manifest!;
};

export async function getStylesForEntryPoint(
  entryPoint: string,
): Promise<string[]> {
  const entryPointUrl = normalizeModulePath(entryPoint, config.root, {
    isViteStyle: true,
  });

  if (devServer) {
    const cached = jsEntryPointToStylesheetsCache.get(entryPointUrl);
    if (cached) {
      return cached;
    }

    const styles = await collectStylesheetsForJsEntryPoint(
      entryPointUrl,
      devServer,
    );
    jsEntryPointToStylesheetsCache.set(entryPointUrl, styles);
    return styles;
  }

  if (config.command === "build") {
    const manifestPath = path.join(
      config.root,
      config.build.outDir,
      "client/.vite/manifest.json",
    );
    const man = await readManifest(manifestPath);

    const entry = man[entryPoint];
    return entry?.css?.map((p) => path.join(config.build.outDir, p)) ?? [];
  }

  return [];
}

const getJsEntryPointsForStylesheet = (
  modules: EnvironmentModuleNode[],
): Set<string> => {
  const affectedEntryPoints = new Set<string>();

  const findEntryPoints = (
    mod: EnvironmentModuleNode,
    visited = new Set<string>(),
  ) => {
    if (mod.id && visited.has(mod.id)) {
      return;
    }

    if (mod.id) {
      visited.add(mod.id);
    }

    if (mod.importers.size === 0 && mod.url) {
      // This is a root module in the graph, i.e., an entry point.
      // The `url` is what we use to query the cache
      affectedEntryPoints.add(mod.url);
      return;
    }

    for (const importer of mod.importers) {
      findEntryPoints(importer, visited);
    }
  };

  for (const mod of modules) {
    findEntryPoints(mod);
  }

  return affectedEntryPoints;
};

export const stylesLookupPlugin = (): Plugin => {
  return {
    name: "rwsdk:styles-lookup",
    configResolved(resolvedConfig) {
      config = resolvedConfig;
    },
    configureServer(server) {
      devServer = server;
      jsEntryPointToStylesheetsCache.clear();
    },
    async handleHotUpdate({ file, server, modules }) {
      if (!isStylesheet(file)) {
        return;
      }

      const clientModuleGraph = server.environments.client.moduleGraph;

      const clientModules = (
        await Promise.all(
          modules.map((mod) => clientModuleGraph.getModuleById(mod.id!)),
        )
      ).filter((m): m is EnvironmentModuleNode => !!m);

      const affectedEntryPoints = getJsEntryPointsForStylesheet(clientModules);

      if (affectedEntryPoints.size > 0) {
        for (const entryPoint of affectedEntryPoints) {
          jsEntryPointToStylesheetsCache.delete(entryPoint);
        }
      } else {
        // Fallback to clearing everything if we can't trace back to an entry point
        jsEntryPointToStylesheetsCache.clear();
      }

      return modules;
    },
  };
};
