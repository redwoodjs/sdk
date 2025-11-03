import debug from "debug";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import colors from "picocolors";
import {
  Connect,
  EnvironmentModuleNode,
  HotUpdateOptions,
  Plugin,
  ViteDevServer,
} from "vite";
import { getShortName } from "../lib/getShortName.mjs";
import { normalizeModulePath } from "../lib/normalizeModulePath.mjs";
import { hasDirective as sourceHasDirective } from "./hasDirective.mjs";
import { invalidateModule } from "./invalidateModule.mjs";
import { isJsFile } from "./isJsFile.mjs";
import { VIRTUAL_SSR_PREFIX } from "./ssrBridgePlugin.mjs";

const log = debug("rwsdk:vite:hmr-plugin");

let hasErrored = false;

const hasDirective = async (filepath: string, directive: string) => {
  if (!isJsFile(filepath)) {
    return false;
  }

  const content = await readFile(filepath, "utf-8");

  return sourceHasDirective(content, directive);
};

export const hasEntryAsAncestor = ({
  module,
  entryFile,
  seen = new Set(),
}: {
  module: any;
  entryFile: string;
  seen?: Set<any>;
}): boolean => {
  // Prevent infinite recursion
  if (seen.has(module)) {
    return false;
  }

  seen.add(module);

  // Check direct importers
  for (const importer of module.importers) {
    if (importer.file === entryFile) return true;

    // Recursively check importers
    if (hasEntryAsAncestor({ module: importer, entryFile, seen })) return true;
  }
  return false;
};

export const miniflareHMRPlugin = (givenOptions: {
  clientFiles: Set<string>;
  serverFiles: Set<string>;
  rootDir: string;
  viteEnvironment: { name: string };
  workerEntryPathname: string;
}): (Plugin | Plugin[])[] => [
  {
    name: "rwsdk:miniflare-hmr",
    configureServer(server) {
      return () => {
        server.middlewares.use(function rwsdkDevServerErrorHandler(
          err: unknown,
          _req: any,
          _res: any,
          next: Connect.NextFunction,
        ) {
          if (err) {
            hasErrored = true;
          }
          next(err);
        });
      };
    },
    async hotUpdate(ctx: HotUpdateOptions) {
      if (ctx.file.includes(".wrangler")) {
        return;
      }

      if (hasErrored) {
        const shortName = getShortName(ctx.file, ctx.server.config.root);
        this.environment.logger.info(
          `${colors.cyan(
            `attempting to recover from error`,
          )}: update to ${colors.dim(shortName)}`,
          {
            clear: true,
            timestamp: true,
          },
        );
        hasErrored = false;
        ctx.server.hot.send({
          type: "full-reload",
          path: "*",
        });
        log("hmr: Full reload after error");
        return [];
      }
      const {
        clientFiles,
        serverFiles,
        viteEnvironment: { name: environment },
        workerEntryPathname: entry,
      } = givenOptions;

      if (process.env.VERBOSE) {
        log(
          `Hot update: (env=${
            this.environment.name
          }) ${ctx.file}\nModule graph:\n\n${dumpFullModuleGraph(
            ctx.server,
            this.environment.name,
          )}`,
        );
      }

      if (!isJsFile(ctx.file) && !ctx.file.endsWith(".css")) {
        log(`hmr: not a js file, skipping`);
        return;
      }

      if (this.environment.name === "ssr") {
        log("SSR update, invalidating recursively", ctx.file);
        invalidateModule(ctx.server, "ssr", ctx.file);
        invalidateModule(
          ctx.server,
          environment,
          VIRTUAL_SSR_PREFIX +
            normalizeModulePath(ctx.file, givenOptions.rootDir),
        );
        log("hmr: invalidated ssr module");
        return [];
      }

      if (!["client", environment].includes(this.environment.name)) {
        log(
          `hmr: incorrect env, skipping (env=${this.environment.name}, worker env=${environment})`,
        );
        return [];
      }

      const hasClientDirective = await hasDirective(ctx.file, "use client");
      const hasServerDirective =
        !hasClientDirective && (await hasDirective(ctx.file, "use server"));
      let clientDirectiveChanged = false;
      let serverDirectiveChanged = false;

      if (!clientFiles.has(ctx.file) && hasClientDirective) {
        clientFiles.add(normalizeModulePath(ctx.file, givenOptions.rootDir));
        clientDirectiveChanged = true;
      } else if (clientFiles.has(ctx.file) && !hasClientDirective) {
        clientFiles.delete(normalizeModulePath(ctx.file, givenOptions.rootDir));
        clientDirectiveChanged = true;
      }

      if (!serverFiles.has(ctx.file) && hasServerDirective) {
        serverFiles.add(normalizeModulePath(ctx.file, givenOptions.rootDir));
        serverDirectiveChanged = true;
      } else if (serverFiles.has(ctx.file) && !hasServerDirective) {
        serverFiles.delete(normalizeModulePath(ctx.file, givenOptions.rootDir));
        serverDirectiveChanged = true;
      }

      if (clientDirectiveChanged) {
        ["client", "ssr", environment].forEach((environment) => {
          invalidateModule(
            ctx.server,
            environment,
            "virtual:use-client-lookup.js",
          );
        });
        invalidateModule(
          ctx.server,
          environment,
          VIRTUAL_SSR_PREFIX + "/@id/virtual:use-client-lookup.js",
        );
        invalidateModule(
          ctx.server,
          environment,
          VIRTUAL_SSR_PREFIX + "virtual:use-client-lookup.js",
        );
      }

      if (serverDirectiveChanged) {
        ["client", "ssr", environment].forEach((environment) => {
          invalidateModule(
            ctx.server,
            environment,
            "virtual:use-server-lookup.js",
          );
        });
        invalidateModule(
          ctx.server,
          environment,
          VIRTUAL_SSR_PREFIX + "/@id/virtual:use-server-lookup.js",
        );
        invalidateModule(
          ctx.server,
          environment,
          VIRTUAL_SSR_PREFIX + "virtual:use-server-lookup.js",
        );
      }

      const modules = Array.from(
        ctx.server.environments[environment].moduleGraph.getModulesByFile(
          ctx.file,
        ) ?? [],
      );

      const isWorkerUpdate = Boolean(modules);

      // The worker needs an update, but this is the client environment
      // => Notify for HMR update of any css files imported by in worker, that are also in the client module graph
      // Why: There may have been changes to css classes referenced, which might css modules to change
      if (this.environment.name === "client") {
        if (isWorkerUpdate) {
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

              for (const clientModule of clientModules ?? []) {
                invalidateModule(ctx.server, "client", clientModule);
              }
            }
          }
        }

        return ctx.modules;
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
          .getModulesByFile(
            resolve(givenOptions.rootDir, "src", "app", "style.css"),
          )
          ?.values()
          .next().value;

        if (m) {
          invalidateModule(ctx.server, environment, m);
        }

        let virtualSSRModuleId =
          VIRTUAL_SSR_PREFIX +
          normalizeModulePath(ctx.file, givenOptions.rootDir);

        if (ctx.file.endsWith(".css")) {
          virtualSSRModuleId += ".js";
        }

        const virtualSSRModule =
          ctx.server.environments[environment].moduleGraph.idToModuleMap.get(
            virtualSSRModuleId,
          );

        if (virtualSSRModule) {
          invalidateModule(ctx.server, environment, virtualSSRModule);
        }

        ctx.server.environments.client.hot.send({
          type: "custom",
          event: "rsc:update",
          data: {
            file: ctx.file,
          },
        });

        log("hmr: sent rsc update");
        return [];
      }
    },
  },
];

function dumpFullModuleGraph(
  server: ViteDevServer,
  environment: string,
  { includeDisconnected = true } = {},
) {
  const moduleGraph = server.environments[environment].moduleGraph;
  const seen = new Set<string>();
  const output: string[] = [];

  function walk(node: EnvironmentModuleNode, depth = 0) {
    const id = node.id || node.url;
    if (!id || seen.has(id)) return;
    seen.add(id);

    const pad = "  ".repeat(depth);
    const suffix = node.id?.startsWith("virtual:") ? " [virtual]" : "";
    output.push(`${pad}- ${id}${suffix}`);

    for (const dep of node.importedModules) {
      walk(dep, depth + 1);
    }
  }

  // Start with all modules with no importers (roots)
  const roots = Array.from(moduleGraph.urlToModuleMap.values()).filter(
    (mod) => mod.importers.size === 0,
  );

  for (const root of roots) {
    walk(root);
  }

  // If requested, show disconnected modules too
  if (includeDisconnected) {
    for (const mod of moduleGraph.urlToModuleMap.values()) {
      const id = mod.id || mod.url;
      if (!seen.has(id)) {
        output.push(`- ${id} [disconnected]`);
      }
    }
  }

  return output.join("\n");
}
