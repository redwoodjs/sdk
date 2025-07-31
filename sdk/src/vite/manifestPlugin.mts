import { readFile } from "node:fs/promises";
import { type Plugin, type ViteDevServer } from "vite";
import debug from "debug";
import { normalizeModulePath } from "../lib/normalizeModulePath.mjs";
import { type ModuleNode } from "vite";

const log = debug("rwsdk:vite:manifest-plugin");

const virtualModuleId = "virtual:rwsdk:manifest.js";
const resolvedVirtualModuleId = "\0" + virtualModuleId;

const getCssForModule = (
  server: ViteDevServer,
  moduleId: string,
  env: "client" | "worker" | "ssr",
) => {
  const css = new Set<any>();
  const stack: string[] = [moduleId];
  const visited = new Set<string>();

  while (stack.length > 0) {
    const currentModuleId = stack.pop()!;

    if (visited.has(currentModuleId)) {
      continue;
    }
    visited.add(currentModuleId);

    const moduleNode =
      server.environments[env].moduleGraph.getModuleById(currentModuleId);

    if (!moduleNode) {
      continue;
    }

    for (const importedModule of moduleNode.importedModules) {
      if (importedModule.url.endsWith(".css")) {
        const absolutePath = importedModule.file!;
        css.add({
          url: importedModule.url,
          // The `ssrTransformResult` has the CSS content, because the default
          // transform for CSS is to a string of the CSS content.
          content: (importedModule as any).ssrTransformResult?.code ?? "",
          absolutePath,
        });
      }

      if (importedModule.id) {
        stack.push(importedModule.id);
      }
    }
  }

  return css;
};

export const manifestPlugin = ({
  clientManifestPath,
  workerManifestPath,
  rscCssMapPath,
  workerEntryPathname,
}: {
  clientManifestPath: string;
  workerManifestPath: string;
  rscCssMapPath: string;
  workerEntryPathname: string;
}): Plugin => {
  let isBuild = false;
  let root: string;

  return {
    name: "rwsdk:manifest",
    configResolved(config) {
      log("Config resolved, command=%s", config.command);
      isBuild = config.command === "build";
      root = config.root;
    },
    resolveId(id) {
      if (id === virtualModuleId) {
        process.env.VERBOSE && log("Resolving virtual module id=%s", id);
        return resolvedVirtualModuleId;
      }
    },
    async load(id) {
      if (id === resolvedVirtualModuleId) {
        process.env.VERBOSE && log("Loading virtual module id=%s", id);
        if (!isBuild) {
          process.env.VERBOSE && log("Not a build, returning empty manifest");
          return `export default {}`;
        }

        log("Reading client manifest from %s", clientManifestPath);
        const clientManifestContent = await readFile(
          clientManifestPath,
          "utf-8",
        );
        const clientManifest = JSON.parse(clientManifestContent);
        const normalizedClientManifest: Record<string, unknown> = {};

        for (const key in clientManifest) {
          const normalizedKey = normalizeModulePath(key, root, {
            isViteStyle: false,
          });

          const entry = clientManifest[key];
          delete clientManifest[key];
          normalizedClientManifest[normalizedKey] = entry;

          entry.file = normalizeModulePath(entry.file, root, {
            isViteStyle: false,
          });

          const normalizedCss: string[] = [];

          if (entry.css) {
            for (const css of entry.css) {
              normalizedCss.push(
                normalizeModulePath(css, root, {
                  isViteStyle: false,
                }),
              );
            }

            entry.css = normalizedCss;
          }
        }

        const rscManifest: Record<
          string,
          {
            css: string[];
          }
        > = {
          global: {
            css: [],
          },
        };

        // Read worker manifest and rsc css map
        log("Reading worker manifest from %s", workerManifestPath);
        const workerManifestContent = await readFile(
          workerManifestPath,
          "utf-8",
        );
        const workerManifest = JSON.parse(workerManifestContent);

        log("Reading RSC CSS map from %s", rscCssMapPath);
        const rscCssMapContent = await readFile(rscCssMapPath, "utf-8");
        const rscCssMap = JSON.parse(rscCssMapContent);

        // 1. Get all CSS bundles for the worker entry point
        const workerManifestEntry = Object.entries(workerManifest).find(
          ([key]) => key.endsWith(workerEntryPathname),
        );
        const allWorkerCssBundles = new Set<string>(
          (workerManifestEntry?.[1] as any)?.css || [],
        );

        // 2. Populate rscManifest for CSS modules from the map
        const usedModuleBundles = new Set<string>();
        for (const moduleId in rscCssMap) {
          const normalizedModuleId = normalizeModulePath(moduleId, root, {
            isViteStyle: true,
          });
          const cssFile = rscCssMap[moduleId];
          const normalizedCssFile = normalizeModulePath(cssFile, root, {
            isViteStyle: false,
          });

          rscManifest[normalizedModuleId] = { css: [normalizedCssFile] };
          usedModuleBundles.add(normalizedCssFile);
        }

        // 3. Add remaining bundles as global CSS
        for (const bundle of allWorkerCssBundles) {
          const normalizedBundle = normalizeModulePath(bundle, root, {
            isViteStyle: false,
          });
          if (!usedModuleBundles.has(normalizedBundle)) {
            rscManifest.global.css.push(normalizedBundle);
          }
        }

        const manifest = {
          client: normalizedClientManifest,
          rsc: rscManifest,
        };

        return `export default ${JSON.stringify(manifest)}`;
      }
    },
    configEnvironment(name, config) {
      if (name !== "worker" && name !== "ssr") {
        return;
      }

      log("Configuring environment: name=%s", name);

      config.optimizeDeps ??= {};
      config.optimizeDeps.esbuildOptions ??= {};
      config.optimizeDeps.esbuildOptions.plugins ??= [];
      config.optimizeDeps.esbuildOptions.plugins.push({
        name: "rwsdk:manifest:esbuild",
        setup(build) {
          log("Setting up esbuild plugin for environment: %s", name);
          build.onResolve({ filter: /^virtual:rwsdk:manifest\.js$/ }, () => {
            log("Resolving virtual manifest module in esbuild");
            return {
              path: "virtual:rwsdk:manifest.js",
              external: true,
            };
          });
        },
      });
    },
    configureServer(server) {
      log("Configuring server middleware for manifest");
      server.middlewares.use("/__rwsdk_manifest", async (req, res, next) => {
        log("Manifest request received: %s", req.url);
        try {
          const url = new URL(req.url!, `http://${req.headers.host}`);
          const scripts = JSON.parse(url.searchParams.get("scripts") || "[]");

          process.env.VERBOSE && log("Transforming scripts: %o", scripts);

          for (const script of scripts) {
            await server.environments.client.transformRequest(script);
          }

          if (workerEntryPathname) {
            await server.environments.worker.transformRequest(
              workerEntryPathname,
            );
          }

          const clientManifest: Record<
            string,
            {
              file: string;
              css: {
                url: string;
                content: string;
                absolutePath: string;
              }[];
            }
          > = {};

          log("Building client manifest from module graph");
          for (const file of server.environments.client.moduleGraph.fileToModulesMap.keys()) {
            const modules =
              server.environments.client.moduleGraph.getModulesByFile(file);

            if (!modules) {
              continue;
            }

            for (const module of modules) {
              if (module.file) {
                const css = getCssForModule(server, module.id!, "client");

                clientManifest[
                  normalizeModulePath(module.file, server.config.root)
                ] = {
                  file: module.url,
                  css: Array.from(css),
                };
              }
            }
          }

          const rscManifest: Record<
            string,
            {
              css: {
                url: string;
                content: string;
                absolutePath: string;
              }[];
            }
          > = {
            global: {
              css: [],
            },
          };

          if (workerEntryPathname) {
            log("Building worker manifest from module graph");
            const workerModule =
              await server.environments.worker.moduleGraph.getModuleByUrl(
                workerEntryPathname,
              );

            if (workerModule) {
              const allCss = getCssForModule(
                server,
                workerModule.id!,
                "worker",
              );

              for (const css of allCss) {
                if (css.url.endsWith(".module.css")) {
                  rscManifest[css.url] = {
                    css: [css],
                  };
                } else {
                  rscManifest.global.css.push(css);
                }
              }
            }
          }

          const manifest = {
            client: clientManifest,
            rsc: rscManifest,
          };

          log("Manifest built successfully");
          process.env.VERBOSE && log("Manifest: %o", manifest);

          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(manifest));
        } catch (e) {
          log("Error building manifest: %o", e);
          next(e);
        }
      });
    },
  };
};
