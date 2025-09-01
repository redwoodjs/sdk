import { Plugin, ResolvedConfig, ViteDevServer } from "vite";
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
      const barrelProcessingPromises = {
        client: Promise.withResolvers<void>(),
        ssr: Promise.withResolvers<void>(),
      };

      server.rwsdk = {
        barrelProcessingPromises: {
          client: barrelProcessingPromises.client.promise,
          ssr: barrelProcessingPromises.ssr.promise,
        },
      };

      const originalListen = server.listen;
      server.listen = async function (...args) {
        const result = await originalListen.apply(this, args);

        // Wait for the worker's dependency scan to complete before proceeding.
        await server.environments.worker.depsOptimizer?.scanProcessing;
        server.environments.worker.depsOptimizer?.getOptimizedDepId;

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

        if (clientFiles.size > 0) {
          server.environments.client.depsOptimizer?.registerMissingImport(
            dummyFilePaths.client,
            dummyFilePaths.client,
          );
          barrelProcessingPromises.client.resolve();
        }

        if (serverFiles.size > 0) {
          server.environments.ssr.depsOptimizer?.registerMissingImport(
            dummyFilePaths.server,
            dummyFilePaths.server,
          );
          barrelProcessingPromises.ssr.resolve();
        }

        return result;
      };
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

      // Create the empty dummy files
      ensureFileSync(dummyFilePaths.client);
      ensureFileSync(dummyFilePaths.server);
      log("Created dummy barrel files at:", dummyFilePaths);

      // This esbuild plugin hijacks the dummy files
      const esbuildPlugin = {
        name: "rwsdk:directive-modules-dev-esbuild",
        setup(build: any) {
          build.onLoad({ filter: /rwsdk-.*-barrel\.js/ }, (args: any) => {
            log("ESBuild loading dummy file %s", args.path);
            const isClient = args.path.includes("client");
            const files = isClient ? clientFiles : serverFiles;
            const contents = generateBarrelContent(files, projectRootDir);
            log("Returning barrel content for %s", args.path);
            return { contents, loader: "js" };
          });
        },
      };

      for (const envName of ["client", "ssr"]) {
        const envConfig = config.environments[envName];
        if (envConfig) {
          // 1. Add the dummy file paths to optimizeDeps.include for both barrels
          envConfig.optimizeDeps ??= {};
          envConfig.optimizeDeps.include ??= [];
          envConfig.optimizeDeps.include.push(
            dummyFilePaths.client,
            dummyFilePaths.server,
          );
          log(
            "Added barrels to optimizeDeps.include for %s",
            envName,
            dummyFilePaths,
          );

          // 2. Add esbuild plugin for the dependency optimizer
          envConfig.optimizeDeps.esbuildOptions ??= {};
          envConfig.optimizeDeps.esbuildOptions.plugins ??= [];
          envConfig.optimizeDeps.esbuildOptions.plugins.push(esbuildPlugin);
        }
      }
    },
  };
};
