import path from "path";
import { Plugin } from "vite";
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
      if (!process.env.VITE_IS_DEV_SERVER || process.env.RWSDK_WORKER_RUN) {
        return;
      }

      // Start the directive scan as soon as the server is configured.
      // We don't await it here, allowing Vite to continue its startup.
      scanPromise = runDirectivesScan({
        rootConfig: server.config,
        environments: server.environments,
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

      // context(justinvdm, 4 Sep 2025): Add middleware to block incoming
      // requests until the scan is complete. This gives us a single hook for
      // preventing app code being processed by vite until the scan is complete.
      // This improves perceived startup time by not blocking Vite's optimizer.
      server.middlewares.use(async (_req, _res, next) => {
        if (scanPromise) {
          await scanPromise;
        }
        next();
      });
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
        env.optimizeDeps ??= {};
        env.optimizeDeps.include ??= [];
        env.optimizeDeps.include.push(
          CLIENT_BARREL_EXPORT_PATH,
          SERVER_BARREL_EXPORT_PATH,
        );

        env.optimizeDeps.esbuildOptions ??= {};
        env.optimizeDeps.esbuildOptions.plugins ??= [];
        env.optimizeDeps.esbuildOptions.plugins.push({
          name: "rwsdk:block-optimizer-for-scan",
          setup(build) {
            build.onStart(async () => {
              // context(justinvdm, 4 Sep 2025): We await the scan promise
              // here because we want to block the optimizer until the scan is
              // complete.
              await scanPromise;
            });
          },
        });
      }
    },
  };
};
