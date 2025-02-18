import { HotUpdateOptions, Plugin } from "vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import { resolve } from "node:path";
import colors from "picocolors";
import { readFile } from "node:fs/promises";

import { getShortName } from '../lib/getShortName.mjs';
import { pathExists } from 'fs-extra';

type BasePluginOptions = Parameters<typeof cloudflare>[0];

type MiniflarePluginOptions = BasePluginOptions & {
}

const hasEntryAsAncestor = (module: any, entryFile: string, seen = new Set()): boolean => {
  // Prevent infinite recursion
  if (seen.has(module)) return false;
  seen.add(module);

  // Check direct importers
  for (const importer of module.importers) {
    if (importer.file === entryFile) return true;

    // Recursively check importers
    if (hasEntryAsAncestor(importer, entryFile, seen)) return true;
  }
  return false;
};

// Cache for "use client" status results
const useClientCache = new Map<string, boolean>();

// Function to invalidate cache for a file
const invalidateUseClientCache = (file: string) => {
  useClientCache.delete(file);
};

const isUseClientModule = async (ctx: HotUpdateOptions, file: string, seen = new Set<string>()): Promise<boolean> => {
  // Prevent infinite recursion
  if (seen.has(file)) return false;
  seen.add(file);

  try {
    // Check cache first
    if (useClientCache.has(file)) {
      return useClientCache.get(file)!;
    }

    // Read and check the file
    const content = await pathExists(file) ? await readFile(file, 'utf-8') : '';

    const hasUseClient = content.includes("'use client'") ||
      content.includes('"use client"');

    if (hasUseClient) {
      useClientCache.set(file, true);
      return true;
    }

    // Get the module from the module graph to find importers
    const module = ctx.server.moduleGraph.getModuleById(file);
    if (!module) {
      useClientCache.set(file, false);
      return false;
    }

    // Check all importers recursively
    for (const importer of module.importers) {
      if (await isUseClientModule(ctx, importer.url, seen)) {
        useClientCache.set(file, true);
        return true;
      }
    }

    useClientCache.set(file, false);
    return false;
  } catch (error) {
    useClientCache.set(file, false);
    return false;
  }
};

export const miniflarePlugin = (
  givenOptions: MiniflarePluginOptions & { rootDir: string, workerEntryPathname: string },
): (Plugin | Plugin[])[] => [
    cloudflare(givenOptions),
    {
      name: 'miniflare-plugin-hmr',
      async hotUpdate(ctx) {
        const environment = givenOptions.viteEnvironment?.name ?? 'worker';
        const entry = givenOptions.workerEntryPathname;

        if (!["client", environment].includes(this.environment.name)) {
          return;
        }

        // todo(justinvdm, 12 Dec 2024): Skip client references

        const modules = Array.from(
          ctx.server.environments[environment].moduleGraph.getModulesByFile(
            ctx.file,
          ) ?? [],
        );

        const isWorkerUpdate =
          ctx.file === entry ||
          modules.some(module => hasEntryAsAncestor(module, entry));

        // The worker doesnt need an update
        // => Short circuit HMR
        if (!isWorkerUpdate) {
          return [];
        }

        // The worker needs an update, but this is the client environment
        // => Notify for HMR update of any css files imported by in worker, that are also in the client module graph
        // Why: There may have been changes to css classes referenced, which might css modules to change
        if (this.environment.name === "client") {
          const cssModules = [];

          for (const [_, module] of ctx.server.environments[environment]
            .moduleGraph.idToModuleMap) {
            // todo(justinvdm, 13 Dec 2024): We check+update _all_ css files in worker module graph,
            // but it could just be a subset of css files that are actually affected, depending
            // on the importers and imports of the changed file. We should be smarter about this.
            if (module.file && module.file.endsWith(".css")) {
              const clientModules =
                ctx.server.environments.client.moduleGraph.getModulesByFile(
                  module.file,
                );

              if (clientModules) {
                cssModules.push(...clientModules.values());
              }
            }
          }

          invalidateUseClientCache(ctx.file);

          return (await isUseClientModule(ctx, ctx.file)) ? [
            ...ctx.modules,
            ...cssModules,
          ] : cssModules
        }

        // The worker needs an update, and the hot check is for the worker environment
        // => Notify for custom RSC-based HMR update, then short circuit HMR
        if (isWorkerUpdate && this.environment.name === environment) {
          const shortName = getShortName(ctx.file, ctx.server.config.root);

          this.environment.logger.info(
            `${colors.green(`worker update`)} ${colors.dim(shortName)}`,
            {
              clear: true,
              timestamp: true,
            },
          );

          const m = ctx.server.environments.client.moduleGraph
            .getModulesByFile(resolve(givenOptions.rootDir, "src", "app", "style.css"))
            ?.values()
            .next().value;

          if (m) {
            ctx.server.environments.client.moduleGraph.invalidateModule(
              m,
              new Set(),
              ctx.timestamp,
              true,
            );
          }

          ctx.server.environments.client.hot.send({
            type: "custom",
            event: "rsc:update",
            data: {
              file: ctx.file,
            },
          });

          return [];
        }
      },
    }
  ]