import path from "node:path";
import fs from "node:fs/promises";
import debug from "debug";

import type {
  Plugin,
  ViteDevServer,
  ResolvedConfig,
  EnvironmentModuleNode,
  ModuleNode,
} from "vite";
import { normalizeModulePath } from "../lib/normalizeModulePath.mjs";

const log = debug("rwsdk:vite:js-entry-points-to-stylesheets");

export interface StylesheetContext {
  isBuild: boolean;
  projectRootDir: string;
  buildOutDir: string;
}

let devServer: ViteDevServer | undefined;
let manifest: Record<string, { file: string; css?: string[] }> | undefined;

const jsEntryPointToStylesheetsCache = new Map<string, string[]>();

const isStylesheet = (file: string) =>
  /\.(css|scss|sass|less|styl|stylus)($|\?)/.test(file);

const collectStylesheetsForJsEntryPoint = async (
  entryPointUrl: string,
  server: ViteDevServer,
): Promise<string[]> => {
  process.env.VERBOSE &&
    log("Collecting stylesheets for JS entry point: %s", entryPointUrl);
  const styles = new Set<string>();
  const entryModule =
    await server.environments.client.moduleGraph.getModuleByUrl(entryPointUrl);

  if (!entryModule) {
    log(`Could not find module for entry point: ${entryPointUrl}`);
    return [];
  }

  const queue: EnvironmentModuleNode[] = [entryModule];
  const visited = new Set<string>([entryModule.id!]);

  while (queue.length > 0) {
    const mod = queue.shift()!;

    if (mod.file && isStylesheet(mod.file) && mod.url) {
      styles.add(mod.url);
    }

    for (const imported of mod.importedModules) {
      if (imported.id && !visited.has(imported.id)) {
        visited.add(imported.id);
        queue.push(imported);
      }
    }
  }

  process.env.VERBOSE &&
    log(
      "Collected stylesheets for entry point %s: %O",
      entryPointUrl,
      Array.from(styles),
    );
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

export async function getStylesheetsForEntryPoint(
  entryPoint: string,
  context: StylesheetContext,
): Promise<string[]> {
  const entryPointUrl = normalizeModulePath(
    entryPoint,
    context.projectRootDir,
    {
      isViteStyle: true,
    },
  );

  if (devServer) {
    const cached = jsEntryPointToStylesheetsCache.get(entryPointUrl);
    if (cached) {
      process.env.VERBOSE &&
        log("Cache hit for entry point: %s", entryPointUrl);
      return cached;
    }
    process.env.VERBOSE && log("Cache miss for entry point: %s", entryPointUrl);

    const styles = await collectStylesheetsForJsEntryPoint(
      entryPointUrl,
      devServer,
    );
    jsEntryPointToStylesheetsCache.set(entryPointUrl, styles);
    log("Cached stylesheets for entry point: %s", entryPointUrl);
    return styles;
  }

  if (context.isBuild) {
    const manifestPath = path.join(
      context.projectRootDir,
      context.buildOutDir,
      "client/.vite/manifest.json",
    );
    const man = await readManifest(manifestPath);
    process.env.VERBOSE && log("Read manifest for build: %s", manifestPath);

    const entry = man[entryPoint];
    const stylesheets = entry?.css?.map((p) => `/${p}`) ?? [];
    process.env.VERBOSE &&
      log(
        "Stylesheets from manifest for entry point %s: %O",
        entryPoint,
        stylesheets,
      );
    return stylesheets;
  }

  return [];
}

const getJsEntryPointsForStylesheet = (
  modules: EnvironmentModuleNode[],
): Set<string> => {
  process.env.VERBOSE &&
    log("Getting JS entry points for stylesheet modules: %O", modules);
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

  process.env.VERBOSE &&
    log("Found affected entry points: %O", Array.from(affectedEntryPoints));
  return affectedEntryPoints;
};

export const jsEntryPointsToStylesheetsPlugin = (): Plugin => {
  return {
    name: "rwsdk:js-entry-points-to-stylesheets",
    configResolved(resolvedConfig) {
      log("Plugin configured");
    },
    configureServer(server) {
      devServer = server;
      jsEntryPointToStylesheetsCache.clear();
      log("Server configured, cache cleared");
    },
    async handleHotUpdate({ file, server, modules }) {
      if (!isStylesheet(file)) {
        return;
      }
      log("HMR update for stylesheet: %s", file);

      const clientModuleGraph = server.environments.client.moduleGraph;

      const clientModules = (
        await Promise.all(
          modules.map((mod) => clientModuleGraph.getModuleById(mod.id!)),
        )
      ).filter((m): m is EnvironmentModuleNode => !!m);

      const affectedEntryPoints = getJsEntryPointsForStylesheet(clientModules);

      if (affectedEntryPoints.size > 0) {
        log(
          "Invalidating cache for affected entry points: %O",
          Array.from(affectedEntryPoints),
        );
        for (const entryPoint of affectedEntryPoints) {
          jsEntryPointToStylesheetsCache.delete(entryPoint);
        }
      } else {
        log("Could not find entry points, clearing entire stylesheet cache");
        jsEntryPointToStylesheetsCache.clear();
      }

      return modules;
    },
  };
};
