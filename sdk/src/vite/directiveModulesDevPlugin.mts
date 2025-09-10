import path from "path";
import { Plugin, ViteDevServer, ResolvedConfig } from "vite";
import { writeFileSync, mkdirSync } from "node:fs";
import { normalizeModulePath } from "../lib/normalizeModulePath.mjs";
import { CLIENT_BARREL_PATH, SERVER_BARREL_PATH } from "../lib/constants.mjs";
import { runDirectivesScan } from "./runDirectivesScan.mjs";

export const VIRTUAL_CLIENT_BARREL_ID = "virtual:rwsdk:client-module-barrel";
export const VIRTUAL_SERVER_BARREL_ID = "virtual:rwsdk:server-module-barrel";

const CLIENT_BARREL_EXPORT_PATH = "rwsdk/__client_barrel";
const SERVER_BARREL_EXPORT_PATH = "rwsdk/__server_barrel";

const generateBarrelContent = (files: Set<string>, projectRootDir: string) => {
  const imports = [...files]
    .filter((file) => file.includes("node_modules"))
    .map(
      (file, i) =>
        `import * as M${i} from '${normalizeModulePath(file, projectRootDir, {
          absolute: true,
        })}';`,
    )
    .join("\n");

  const exports =
    "export default {\n" +
    [...files]
      .filter((file) => file.includes("node_modules"))
      .map(
        (file, i) => `  '${normalizeModulePath(file, projectRootDir)}': M${i},`,
      )
      .join("\n") +
    "\n};";

  return `${imports}\n\n${exports}`;
};

export const directiveModulesDevPlugin = ({
  projectRootDir,
  clientFiles,
  serverFiles,
}: {
  projectRootDir: string;
  clientFiles: Set<string>;
  serverFiles: Set<string>;
}): Plugin => {
  let scanPromise: Promise<void> | undefined = undefined;
  let config: ResolvedConfig;

  return {
    name: "rwsdk:directive-modules-dev",

    configResolved(resolvedConfig) {
      config = resolvedConfig;

      if (config.command !== "serve") {
        return;
      }

      // Create dummy files to give esbuild a real path to resolve.
      mkdirSync(path.dirname(CLIENT_BARREL_PATH), { recursive: true });
      writeFileSync(CLIENT_BARREL_PATH, "");
      mkdirSync(path.dirname(SERVER_BARREL_PATH), { recursive: true });
      writeFileSync(SERVER_BARREL_PATH, "");

      for (const env of Object.values(config.environments || {})) {
        env.optimizeDeps ??= {};
        env.optimizeDeps.include ??= [];
        env.optimizeDeps.entries ??= [];
        env.optimizeDeps.include.push(
          CLIENT_BARREL_EXPORT_PATH,
          SERVER_BARREL_EXPORT_PATH,
        );

        env.optimizeDeps.esbuildOptions ??= {};
        env.optimizeDeps.esbuildOptions.plugins ??= [];
        env.optimizeDeps.esbuildOptions.plugins.push({
          name: "rwsdk:block-optimizer-for-scan",
          setup(build) {
            let entriesAdded = false;
            build.onStart(async () => {
              await scanPromise;

              if (!entriesAdded) {
                entriesAdded = true;
                const appClientFiles = [...clientFiles].filter(
                  (file) => !file.includes("node_modules"),
                );
                const appServerFiles = [...serverFiles].filter(
                  (file) => !file.includes("node_modules"),
                );

                const clientEntries =
                  (config.environments.client.optimizeDeps.entries = Array.from(
                    new Set(
                      Array.isArray(
                        config.environments.client.optimizeDeps.entries,
                      )
                        ? config.environments.client.optimizeDeps.entries
                        : ([] as string[]).concat(
                            config.environments.client.optimizeDeps.entries ??
                              [],
                          ),
                    ),
                  ));

                const workerEntries =
                  (config.environments.worker.optimizeDeps.entries = Array.from(
                    new Set(
                      Array.isArray(
                        config.environments.worker.optimizeDeps.entries,
                      )
                        ? config.environments.worker.optimizeDeps.entries
                        : ([] as string[]).concat(
                            config.environments.worker.optimizeDeps.entries ??
                              [],
                          ),
                    ),
                  ));

                clientEntries.push(...appClientFiles);
                workerEntries.push(...appServerFiles);
                console.log("workerEntries", workerEntries);
                console.log("clientEntries", clientEntries);
              }
            });
          },
        });
      }
    },

    configureServer(server) {
      if (!process.env.VITE_IS_DEV_SERVER || process.env.RWSDK_WORKER_RUN) {
        return;
      }

      scanPromise = runDirectivesScan({
        rootConfig: server.config,
        environments: server.environments,
        clientFiles,
        serverFiles,
      }).then(() => {
        const clientBarrelContent = generateBarrelContent(
          clientFiles,
          projectRootDir,
        );
        writeFileSync(CLIENT_BARREL_PATH, clientBarrelContent);

        const serverBarrelContent = generateBarrelContent(
          serverFiles,
          projectRootDir,
        );
        writeFileSync(SERVER_BARREL_PATH, serverBarrelContent);
      });

      server.middlewares.use(async (_req, _res, next) => {
        if (scanPromise) {
          await scanPromise;
        }
        next();
      });
    },
  };
};
