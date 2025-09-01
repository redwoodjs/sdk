import { Plugin, ResolvedConfig } from "vite";
import debug from "debug";
import path from "node:path";
import { ensureFileSync } from "fs-extra";
import { normalizeModulePath } from "../lib/normalizeModulePath.mjs";

const log = debug("rwsdk:vite:directive-modules-dev");

// Augment the ViteDevServer type to include our custom property
declare module "vite" {
  interface ViteDevServer {
    rwsdk?: {
      barrelProcessingPromises?: {
        client?: Promise<void>;
        ssr?: Promise<void>;
      };
    };
  }
}

export const VIRTUAL_CLIENT_BARREL_ID = "virtual:rwsdk:client-module-barrel";
export const VIRTUAL_SERVER_BARREL_ID = "virtual:rwsdk:server-module-barrel";

const barrelIds = {
  client: VIRTUAL_CLIENT_BARREL_ID,
  server: VIRTUAL_SERVER_BARREL_ID,
};

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
      .map((file, i) => `  '${file}': M${i},`)
      .join("\n") +
    "\n};";

  return `${imports}\n\n${exports}`;
};

export const directiveModulesDevPlugin = ({
  clientFiles,
  serverFiles,
  projectRootDir,
}: {
  clientFiles: Set<string>;
  serverFiles: Set<string>;
  projectRootDir: string;
}): Plugin => {
  return {
    name: "rwsdk:directive-modules-dev",
    enforce: "pre",
    configureServer(server) {
      const workerScanComplete = Promise.withResolvers<void>();

      // Worker: Run first, then signal completion
      const workerOptimizer = server.environments.worker.depsOptimizer;
      if (workerOptimizer) {
        const originalInit = workerOptimizer.init;
        workerOptimizer.init = async function (...args) {
          await originalInit.apply(this, args);
          await workerOptimizer.scanProcessing;
          log("Worker scan complete. Signaling to client and SSR optimizers.");
          workerScanComplete.resolve();
        };
      }

      // Client & SSR: Wait for worker, then run
      for (const envName of ["client", "ssr"]) {
        const optimizer = server.environments[envName]?.depsOptimizer;
        if (optimizer) {
          const originalInit = optimizer.init;
          optimizer.init = async function (...args) {
            log(`Optimizer for '${envName}' is waiting for worker scan...`);
            await workerScanComplete.promise;
            log(
              `Worker scan finished. Optimizer for '${envName}' is proceeding.`,
            );
            await originalInit.apply(this, args);
          };
        }
      }
    },
    configResolved(config) {
      if (config.command !== "serve") {
        return;
      }

      const dummyFilePaths = {
        client: path.join(
          projectRootDir,
          "node_modules",
          ".vite",
          "rwsdk-client-barrel.js",
        ),
        server: path.join(
          projectRootDir,
          "node_modules",
          ".vite",
          "rwsdk-server-barrel.js",
        ),
      };

      // Create the dummy files so that Vite can resolve them
      ensureFileSync(dummyFilePaths.client);
      ensureFileSync(dummyFilePaths.server);

      const esbuildPlugin = {
        name: "rwsdk:esbuild:barrel-handler",
        setup(build: any) {
          const barrelPaths = Object.values(dummyFilePaths);
          const filter = new RegExp(
            `^(${barrelPaths
              .map((p) => p.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&"))
              .join("|")})$`,
          );

          build.onLoad({ filter }, async (args: any) => {
            if (args.path === dummyFilePaths.client) {
              log("onLoad for client barrel with %d files", clientFiles.size);
              return {
                contents: generateBarrelContent(clientFiles, projectRootDir),
                loader: "js",
              };
            }
            if (args.path === dummyFilePaths.server) {
              log("onLoad for server barrel with %d files", serverFiles.size);
              return {
                contents: generateBarrelContent(serverFiles, projectRootDir),
                loader: "js",
              };
            }
            return null;
          });
        },
      };

      for (const [envName, env] of Object.entries(config.environments)) {
        if (envName === "client" || envName === "ssr") {
          env.optimizeDeps.include = [
            ...(env.optimizeDeps.include || []),
            dummyFilePaths.client,
            dummyFilePaths.server,
          ];
          env.optimizeDeps.esbuildOptions = {
            ...env.optimizeDeps.esbuildOptions,
            plugins: [
              ...(env.optimizeDeps.esbuildOptions?.plugins || []),
              esbuildPlugin,
            ],
          };
        }
      }
    },
  };
};
