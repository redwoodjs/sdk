import { readFile } from "node:fs/promises";
import { type Plugin, type ViteDevServer } from "vite";
import { normalizeModulePath } from "../lib/normalizeModulePath.mjs";

const virtualModuleId = "virtual:manifest.js";
const resolvedVirtualModuleId = "\0" + virtualModuleId;

const getCssForModule = (
  server: ViteDevServer,
  moduleId: string,
  css: Set<string>,
) => {
  const moduleNode = server.moduleGraph.getModuleById(moduleId);

  if (!moduleNode) {
    return;
  }

  for (const importedModule of moduleNode.importedModules) {
    if (importedModule.url.endsWith(".css")) {
      css.add(importedModule.url);
    }

    getCssForModule(server, importedModule.id!, css);
  }
};

export const manifestPlugin = ({
  manifestPath,
}: {
  manifestPath: string;
}): Plugin => {
  let isBuild = false;

  return {
    name: "rwsdk:manifest",
    configResolved(config) {
      isBuild = config.command === "build";
    },
    resolveId(id) {
      if (id === virtualModuleId) {
        return resolvedVirtualModuleId;
      }
    },
    async load(id) {
      if (id === resolvedVirtualModuleId) {
        if (!isBuild) {
          return `export default {}`;
        }

        const manifestContent = await readFile(manifestPath, "utf-8");
        return `export default ${manifestContent}`;
      }
    },
    configureServer(server) {
      server.middlewares.use("/__rwsdk_manifest", async (req, res, next) => {
        try {
          const manifest: Record<string, { file: string; css: string[] }> = {};

          for (const file of server.moduleGraph.fileToModulesMap.keys()) {
            const modules = server.moduleGraph.getModulesByFile(file);

            if (!modules) {
              continue;
            }

            for (const module of modules) {
              if (module.file) {
                const css = new Set<string>();
                getCssForModule(server, module.id!, css);

                manifest[normalizeModulePath(module.file, server.config.root)] =
                  {
                    file: module.url,
                    css: Array.from(css),
                  };
              }
            }
          }

          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(manifest));
        } catch (e) {
          next(e);
        }
      });
    },
  };
};
