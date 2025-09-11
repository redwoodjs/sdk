import path from "path";
import { Plugin } from "vite";
import { writeFileSync, mkdirSync, promises as fs } from "node:fs";
import { normalizeModulePath } from "../lib/normalizeModulePath.mjs";
import {
  VENDOR_CLIENT_BARREL_PATH,
  VENDOR_SERVER_BARREL_PATH,
} from "../lib/constants.mjs";
import { runDirectivesScan } from "./runDirectivesScan.mjs";

const VENDOR_CLIENT_BARREL_EXPORT_PATH = "rwsdk/__vendor_client_barrel";
const VENDOR_SERVER_BARREL_EXPORT_PATH = "rwsdk/__vendor_server_barrel";

const generateVendorBarrelContent = (
  files: Set<string>,
  projectRootDir: string,
) => {
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
  barrelFilePath: string,
) => {
  return [...files]
    .filter((file) => !file.includes("node_modules"))
    .map((file) => {
      const resolvedPath = normalizeModulePath(file, projectRootDir, {
        absolute: true,
      });
      return `import "${resolvedPath}";`;
    })
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
  const { promise: scanPromise, resolve: resolveScanPromise } =
    Promise.withResolvers<void>();

  const tempDir = path.join(projectRootDir, ".rwsdk", "temp");
  const APP_CLIENT_BARREL_PATH = path.join(tempDir, "app-client-barrel.js");
  const APP_SERVER_BARREL_PATH = path.join(tempDir, "app-server-barrel.js");

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
        resolveScanPromise();
      });

      server.middlewares.use(async (_req, _res, next) => {
        await scanPromise;
        next();
      });
    },

    configResolved(config) {
      if (config.command !== "serve") {
        return;
      }

      // Create dummy files for the application barrels
      mkdirSync(path.dirname(APP_CLIENT_BARREL_PATH), { recursive: true });
      writeFileSync(APP_CLIENT_BARREL_PATH, "");
      mkdirSync(path.dirname(APP_SERVER_BARREL_PATH), { recursive: true });
      writeFileSync(APP_SERVER_BARREL_PATH, "");

      for (const [envName, env] of Object.entries(config.environments || {})) {
        env.optimizeDeps ??= {};
        env.optimizeDeps.include ??= [];
        const entries = (env.optimizeDeps.entries = castArray(
          env.optimizeDeps.entries ?? [],
        ));
        env.optimizeDeps.include.push(
          VENDOR_CLIENT_BARREL_EXPORT_PATH,
          VENDOR_SERVER_BARREL_EXPORT_PATH,
        );

        if (envName === "client") {
          entries.push(APP_CLIENT_BARREL_PATH);
        } else if (envName === "worker") {
          entries.push(APP_SERVER_BARREL_PATH);
        }

        env.optimizeDeps.esbuildOptions ??= {};
        env.optimizeDeps.esbuildOptions.plugins ??= [];
        env.optimizeDeps.esbuildOptions.plugins.unshift({
          name: "rwsdk:app-barrel-blocker",
          setup(build) {
            const barrelPaths = [
              APP_CLIENT_BARREL_PATH,
              APP_SERVER_BARREL_PATH,
            ];
            const filter = new RegExp(
              `(${barrelPaths.map((p) => p.replace(/\\/g, "\\\\")).join("|")})$`,
            );

            build.onResolve({ filter: /.*/ }, async (args: any) => {
              // Handle barrel files
              if (filter.test(args.path)) {
                await scanPromise;
                return {
                  path: args.path,
                  namespace: "rwsdk-app-barrel-ns",
                };
              }
              if (
                args.path === VENDOR_CLIENT_BARREL_PATH ||
                args.path === VENDOR_SERVER_BARREL_PATH
              ) {
                await scanPromise;
                return {
                  path: args.path,
                  namespace: "rwsdk-vendor-barrel-ns",
                };
              }

              // context(justinvdm, 11 Sep 2025): Prevent Vite from
              // externalizing our application files. If we don't, paths
              // imported in our application barrel files will be marked as
              // external, and thus not scanned for dependencies.
              if (
                args.path.startsWith("/") &&
                (args.path.includes("/src/") ||
                  args.path.includes("/generated/")) &&
                !args.path.includes("node_modules")
              ) {
                // By returning a result, we claim the module and prevent vite:dep-scan
                // from marking it as external.
                return {
                  path: args.path,
                };
              }
            });

            build.onLoad(
              { filter: /.*/, namespace: "rwsdk-app-barrel-ns" },
              (args) => {
                const isServerBarrel = args.path.includes("app-server-barrel");
                const files = isServerBarrel ? serverFiles : clientFiles;
                const content = generateAppBarrelContent(
                  files,
                  projectRootDir,
                  args.path,
                );
                return {
                  contents: content,
                  loader: "js",
                };
              },
            );
            build.onLoad(
              { filter: /.*/, namespace: "rwsdk-vendor-barrel-ns" },
              (args) => {
                const isServerBarrel = args.path.includes(
                  "rwsdk-vendor-server-barrel",
                );
                const files = isServerBarrel ? serverFiles : clientFiles;
                const content = generateVendorBarrelContent(
                  files,
                  projectRootDir,
                );
                return {
                  contents: content,
                  loader: "js",
                };
              },
            );
          },
        });
      }
    },
  };
};

const castArray = <T,>(value: T | T[]): T[] => {
  return Array.isArray(value) ? value : [value];
};
