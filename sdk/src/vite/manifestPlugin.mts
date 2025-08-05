import { readFile } from "node:fs/promises";
import { type Plugin, type ViteDevServer } from "vite";
import debug from "debug";
import { normalizeModulePath } from "../lib/normalizeModulePath.mjs";
import { type ModuleNode } from "vite";

const log = debug("rwsdk:vite:manifest-plugin");

const virtualModuleId = "virtual:rwsdk:manifest.js";
const resolvedVirtualModuleId = "\0" + virtualModuleId;

const getCssForModule = async (
  server: ViteDevServer,
  moduleUrl: string,
  css: Set<{
    url: string;
    content: string;
    absolutePath: string;
  }>,
): Promise<void> => {
  const stack: string[] = [moduleUrl];
  const visited = new Set<string>();

  while (stack.length > 0) {
    const currentModuleUrl = stack.pop()!;

    if (visited.has(currentModuleUrl)) {
      continue;
    }
    visited.add(currentModuleUrl);

    const moduleNode =
      await server.environments.client.moduleGraph.getModuleByUrl(
        currentModuleUrl,
      );

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
};

export const manifestPlugin = ({
  manifestPath,
}: {
  manifestPath: string;
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

        log("Reading manifest from %s", manifestPath);
        const manifestContent = await readFile(manifestPath, "utf-8");
        const manifest = JSON.parse(manifestContent);
        const normalizedManifest: Record<string, unknown> = {};

        for (const key in manifest) {
          const normalizedKey = normalizeModulePath(key, root, {
            isViteStyle: false,
          });

          const entry = manifest[key];
          delete manifest[key];
          normalizedManifest[normalizedKey] = entry;

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

        return `export default ${JSON.stringify(normalizedManifest)}`;
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

          const manifest: Record<
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

          log("Building manifest from module graph");
          for (const file of server.environments.client.moduleGraph.fileToModulesMap.keys()) {
            const modules =
              server.environments.client.moduleGraph.getModulesByFile(file);

            if (!modules) {
              continue;
            }

            for (const module of modules) {
              if (module.file) {
                const css = new Set<any>();
                await getCssForModule(server, module.url, css);

                manifest[normalizeModulePath(module.file, server.config.root)] =
                  {
                    file: module.url,
                    css: Array.from(css),
                  };
              }
            }
          }

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
