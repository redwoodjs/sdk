import { readFile, writeFile } from "node:fs/promises";
import { type Plugin, type ViteDevServer } from "vite";
import debug from "debug";
import { normalizeModulePath } from "../lib/normalizeModulePath.mjs";
import path from "node:path";

const log = debug("rwsdk:vite:manifest-plugin");

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
  let root: string;

  return {
    name: "rwsdk:manifest",
    configResolved(config) {
      log("Config resolved, command=%s", config.command);
      root = config.root;
    },
    async writeBundle(options, bundle) {
      if (this.environment.name !== "worker") {
        return;
      }

      log("writeBundle hook for worker environment");

      log("Reading client manifest from %s", clientManifestPath);
      const clientManifestContent = await readFile(clientManifestPath, "utf-8");
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

      log("Reading worker manifest from %s", workerManifestPath);
      const workerManifestContent = await readFile(workerManifestPath, "utf-8");
      const workerManifest = JSON.parse(workerManifestContent);

      log("Reading RSC CSS map from %s", rscCssMapPath);
      const rscCssMapContent = await readFile(rscCssMapPath, "utf-8");
      const rscCssMap = JSON.parse(rscCssMapContent);

      const workerManifestEntry = Object.entries(workerManifest).find(([key]) =>
        key.endsWith(workerEntryPathname),
      );
      const allWorkerCssBundles = new Set<string>(
        (workerManifestEntry?.[1] as any)?.css || [],
      );

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

      for (const bundlePath of allWorkerCssBundles) {
        const normalizedBundle = normalizeModulePath(bundlePath, root, {
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

      const manifestString = JSON.stringify(manifest);

      const workerBundlePath = path.join(options.dir!, "worker.js");
      log("Reading worker bundle from %s", workerBundlePath);
      const workerBundleContent = await readFile(workerBundlePath, "utf-8");

      log("Replacing manifest placeholder in worker bundle");
      const newBundleContent = workerBundleContent.replace(
        '"__RWS_MANIFEST_PLACEHOLDER__"',
        manifestString,
      );

      log("Writing updated worker bundle to %s", workerBundlePath);
      await writeFile(workerBundlePath, newBundleContent);
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
