import path from "path";
import { Plugin, ViteDevServer } from "vite";
import { writeFileSync, mkdirSync } from "node:fs";
import { normalizeModulePath } from "../lib/normalizeModulePath.mjs";
import { CLIENT_BARREL_PATH, SERVER_BARREL_PATH } from "../lib/constants.mjs";
import { runDirectivesScan } from "./runDirectivesScan.mjs";

// Awaiting this promise will ensure that the worker environment's directive
// scan is complete.
let workerScanComplete: Promise<void>;

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

let scanPromise: Promise<void> | null = null;

export const directiveModulesDevPlugin = ({
  clientFiles,
  serverFiles,
  projectRootDir,
}: {
  clientFiles: Set<string>;
  serverFiles: Set<string>;
  projectRootDir: string;
}): Plugin => {
  let server: ViteDevServer;

  return {
    name: "rwsdk:directive-modules-dev",

    configureServer(_server) {
      server = _server;
    },

    configResolved(config) {
      if (config.command !== "serve") {
        return;
      }

      // Create dummy files to give esbuild a real path to resolve.
      mkdirSync(path.dirname(CLIENT_BARREL_PATH), { recursive: true });
      writeFileSync(CLIENT_BARREL_PATH, "");
      mkdirSync(path.dirname(SERVER_BARREL_PATH), { recursive: true });
      writeFileSync(SERVER_BARREL_PATH, "");

      const esbuildScanTriggerPlugin = {
        name: "rwsdk:esbuild-scan-trigger",
        setup(build: any) {
          build.onResolve(
            { filter: /rwsdk___server_barrel|rwsdk___client_barrel/ },
            (args: any) => {
              return {
                path: args.path,
                namespace: "rwsdk-barrel",
              };
            },
          );

          build.onLoad(
            { filter: /.*/, namespace: "rwsdk-barrel" },
            async (args: any) => {
              if (!scanPromise) {
                scanPromise = runDirectivesScan({
                  rootConfig: server.config,
                  environment: server.environments.worker,
                  clientFiles,
                  serverFiles,
                });
              }
              await scanPromise;

              const isClient = args.path === "rwsdk___client_barrel";
              const content = generateBarrelContent(
                isClient ? clientFiles : serverFiles,
                projectRootDir,
              );

              return {
                contents: content,
                loader: "js",
              };
            },
          );
        },
      };

      for (const [envName, env] of Object.entries(config.environments || {})) {
        if (envName === "client" || envName === "ssr") {
          env.optimizeDeps.include = [
            ...(env.optimizeDeps.include || []),
            CLIENT_BARREL_EXPORT_PATH,
            SERVER_BARREL_EXPORT_PATH,
          ];
          env.optimizeDeps.esbuildOptions ??= {};
          env.optimizeDeps.esbuildOptions.plugins = [
            ...(env.optimizeDeps.esbuildOptions.plugins || []),
            esbuildScanTriggerPlugin,
          ];
        }
      }
    },
  };
};
