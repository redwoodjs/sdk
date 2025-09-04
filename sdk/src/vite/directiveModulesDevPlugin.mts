import path from "path";
import { Plugin, ViteDevServer } from "vite";
import { writeFileSync, mkdirSync } from "node:fs";
import { normalizeModulePath } from "../lib/normalizeModulePath.mjs";
import { CLIENT_BARREL_PATH, SERVER_BARREL_PATH } from "../lib/constants.mjs";
import { runDirectivesScan } from "./runDirectivesScan.mjs";

// Awaiting this promise will ensure that the worker environment's directive
// scan is complete.
let scanPromise: Promise<void> | null = null;

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
  clientFiles,
  serverFiles,
  projectRootDir,
}: {
  clientFiles: Set<string>;
  serverFiles: Set<string>;
  projectRootDir: string;
}): Plugin => {
  let scanPromise: Promise<void> | null = null;

  return {
    name: "rwsdk:directive-modules-dev",

    configureServer(server) {
      // context(justinvdm, 4 Sep 2025): We need to patch the optimizer's init
      // method to ensure our directive scan runs before Vite's dependency
      // optimization process begins.
      for (const env of Object.values(server.environments)) {
        if (env.name === "client" || env.name === "ssr") {
          const optimizer = env.depsOptimizer;
          if (!optimizer) {
            continue;
          }

          const originalInit = optimizer.init;

          optimizer.init = async function (...args: any[]) {
            if (!scanPromise) {
              scanPromise = runDirectivesScan({
                rootConfig: server.config,
                environment: server.environments.worker,
                clientFiles,
                serverFiles,
              }).then(() => {
                // After the scan is complete, write the barrel files.
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
            }

            await scanPromise;
            return originalInit.apply(this, args as any);
          };
        }
      }
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

      for (const [envName, env] of Object.entries(config.environments || {})) {
        if (envName === "client" || envName === "ssr") {
          env.optimizeDeps ??= {};
          env.optimizeDeps.include ??= [];
          env.optimizeDeps.include.push(
            CLIENT_BARREL_EXPORT_PATH,
            SERVER_BARREL_EXPORT_PATH,
          );
        }
      }
    },
  };
};
