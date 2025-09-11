import path from "path";
import os from "os";
import { Plugin } from "vite";
import { writeFileSync, mkdirSync, mkdtempSync } from "node:fs";
import { normalizeModulePath } from "../lib/normalizeModulePath.mjs";
import { CLIENT_BARREL_PATH, SERVER_BARREL_PATH } from "../lib/constants.mjs";
import { runDirectivesScan } from "./runDirectivesScan.mjs";
import fs from "node:fs/promises";

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

const generateAppBarrelContent = (
  files: Set<string>,
  projectRootDir: string,
) => {
  return [...files]
    .filter((file) => !file.includes("node_modules"))
    .map(
      (file) =>
        `import '${normalizeModulePath(file, projectRootDir, {
          absolute: true,
        })}';`,
    )
    .join("\n");
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
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "rwsdk-"));
  const APP_CLIENT_BARREL_PATH = path.join(tempDir, "app-client-barrel.js");
  const APP_SERVER_BARREL_PATH = path.join(tempDir, "app-server-barrel.js");
  const { promise: scanPromise, resolve: resolveScanPromise } =
    Promise.withResolvers<void>();

  return {
    name: "rwsdk:directive-modules-dev",

    configureServer(server) {
      if (!process.env.VITE_IS_DEV_SERVER || process.env.RWSDK_WORKER_RUN) {
        resolveScanPromise();
        return;
      }

      runDirectivesScan({
        rootConfig: server.config,
        environments: server.environments,
        clientFiles,
        serverFiles,
      }).then(() => {
        console.log("[rwsdk] Directive scan complete. Writing barrel files...");
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

        const appClientBarrelContent = generateAppBarrelContent(
          clientFiles,
          projectRootDir,
        );
        writeFileSync(APP_CLIENT_BARREL_PATH, appClientBarrelContent);

        const appServerBarrelContent = generateAppBarrelContent(
          serverFiles,
          projectRootDir,
        );
        writeFileSync(APP_SERVER_BARREL_PATH, appServerBarrelContent);
        console.log("[rwsdk] Barrel files written.");
        resolveScanPromise();
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
      writeFileSync(APP_CLIENT_BARREL_PATH, "");
      writeFileSync(APP_SERVER_BARREL_PATH, "");

      for (const [envName, env] of Object.entries(config.environments || {})) {
        env.optimizeDeps ??= {};
        env.optimizeDeps.include ??= [];
        env.optimizeDeps.entries ??= [];
        const entries = (env.optimizeDeps.entries = castArray(
          env.optimizeDeps.entries ?? [],
        ));
        env.optimizeDeps.include.push(
          CLIENT_BARREL_EXPORT_PATH,
          SERVER_BARREL_EXPORT_PATH,
        );

        if (envName === "client") {
          entries.push(APP_CLIENT_BARREL_PATH);
        } else if (envName === "worker") {
          entries.push(APP_SERVER_BARREL_PATH);
        }

        env.optimizeDeps.esbuildOptions ??= {};
        env.optimizeDeps.esbuildOptions.plugins ??= [];
        env.optimizeDeps.esbuildOptions.plugins.unshift({
          name: "rwsdk:await-app-barrels",
          setup(build) {
            build.onResolve({ filter: /.*/ }, async (args: any) => {
              if (
                args.path === APP_CLIENT_BARREL_PATH ||
                args.path === APP_SERVER_BARREL_PATH
              ) {
                console.log(
                  `[rwsdk] onResolve for app barrel: [${envName}] ${args.path}. Awaiting scan...`,
                );
                await scanPromise;
                console.log(
                  `[rwsdk] onResolve scan complete for: [${envName}] ${args.path}.`,
                );
              }
              return null;
            });

            build.onLoad({ filter: /.*/ }, async (args: any) => {
              if (args.path.includes("user/functions.ts")) {
                console.log(
                  `[rwsdk] Confirmed: esbuild is loading the target server file: ${args.path}`,
                );
              }

              if (
                args.path === APP_CLIENT_BARREL_PATH ||
                args.path === APP_SERVER_BARREL_PATH
              ) {
                const content = await fs.readFile(args.path, "utf-8");
                console.log(
                  `[rwsdk] onLoad for app barrel: [${envName}] ${args.path}\n--- barrel content ---\n${content}\n--- end barrel content ---`,
                );
                return { contents: content, loader: "js" };
              }
              return null;
            });
          },
        });
      }
    },
  };
};
const castArray = <T,>(value: T | T[]): T[] => {
  return Array.isArray(value) ? value : [value];
};
