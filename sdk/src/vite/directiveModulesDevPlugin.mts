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
              await new Promise((resolve) => setTimeout(resolve, 2000));
              log("onLoad for client barrel with %d files", clientFiles.size);
              return {
                contents: generateBarrelContent(clientFiles, projectRootDir),
                loader: "js",
              };
            }
            if (args.path === dummyFilePaths.server) {
              await new Promise((resolve) => setTimeout(resolve, 2000));
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
