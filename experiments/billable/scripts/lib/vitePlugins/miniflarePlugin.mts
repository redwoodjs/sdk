import { Plugin } from "vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import { resolve } from "node:path";
import colors from "picocolors";

import { ROOT_DIR, SRC_DIR } from "../constants.mjs";
import { getShortName } from '../getShortName.mjs';

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

export const miniflarePlugin = (
  givenOptions: MiniflarePluginOptions,
): Plugin[] => [
    cloudflare(givenOptions),
    {
      name: 'miniflare-plugin-hmr',
      hotUpdate(ctx) {
        const environment = givenOptions.viteEnvironment?.name ?? 'worker';
        const entry = resolve(ROOT_DIR, 'src', 'worker.tsx');

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

          return [
            ...ctx.modules,
            ...cssModules,
          ];
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
            .getModulesByFile(resolve(SRC_DIR, "app", "style.css"))
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