import { mkdirSync, mkdtempSync, realpathSync, writeFileSync } from "node:fs";
import os from "os";
import path from "path";
import { Plugin } from "vite";

import {
  VENDOR_CLIENT_BARREL_PATH as SDK_VENDOR_CLIENT_BARREL_PATH,
  VENDOR_SERVER_BARREL_PATH as SDK_VENDOR_SERVER_BARREL_PATH,
  VENDOR_CLIENT_BARREL_EXPORT_PATH,
  VENDOR_SERVER_BARREL_EXPORT_PATH,
} from "../lib/constants.mjs";
import { normalizeModulePath } from "../lib/normalizeModulePath.mjs";
import { setVendorBarrelPaths } from "./barrelPaths.mjs";
import {
  ConfigurableEsbuildOptions,
  runDirectivesScan,
} from "./runDirectivesScan.mjs";

export const generateVendorBarrelContent = (
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

export const generateAppBarrelContent = (
  files: Set<string>,
  projectRootDir: string,
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
  workerEntryPathname,
  esbuildOptions,
}: {
  clientFiles: Set<string>;
  serverFiles: Set<string>;
  projectRootDir: string;
  workerEntryPathname: string;
  esbuildOptions: ConfigurableEsbuildOptions;
}): Plugin => {
  const {
    promise: scanPromise,
    resolve: resolveScanPromise,
    reject: rejectScanPromise,
  } = Promise.withResolvers<void>();

  const tempDir = mkdtempSync(path.join(realpathSync(os.tmpdir()), "rwsdk-"));
  const APP_CLIENT_BARREL_PATH = path.join(tempDir, "app-client-barrel.js");
  const APP_SERVER_BARREL_PATH = path.join(tempDir, "app-server-barrel.js");
  const VENDOR_CLIENT_BARREL_PATH = path.join(
    tempDir,
    "vendor-client-barrel.js",
  );
  const VENDOR_SERVER_BARREL_PATH = path.join(
    tempDir,
    "vendor-server-barrel.js",
  );

  setVendorBarrelPaths({
    client: VENDOR_CLIENT_BARREL_PATH,
    server: VENDOR_SERVER_BARREL_PATH,
  });

  return {
    name: "rwsdk:directive-modules-dev",
    enforce: "pre",

    load(id) {
      const isClientBarrel =
        id === VENDOR_CLIENT_BARREL_EXPORT_PATH ||
        id === SDK_VENDOR_CLIENT_BARREL_PATH;
      const isServerBarrel =
        id === VENDOR_SERVER_BARREL_EXPORT_PATH ||
        id === SDK_VENDOR_SERVER_BARREL_PATH;

      if (isClientBarrel) {
        return generateVendorBarrelContent(clientFiles, projectRootDir);
      }
      if (isServerBarrel) {
        return generateVendorBarrelContent(serverFiles, projectRootDir);
      }
      return null;
    },

    configureServer(server) {
      // context(justinvdm, 19 Nov 2025): We must run this hook before the
      // Cloudflare plugin's `configureServer` hook. The Cloudflare plugin makes
      // a request back to the dev server to determine worker exports, which
      // triggers Vite's dependency optimizer. Our esbuild plugin for the
      // optimizer blocks on `scanPromise`. By running this first with `enforce: 'pre'`,
      // we ensure our scan is kicked off before the Cloudflare plugin can trigger
      // the optimizer, preventing a deadlock.
      if (!process.env.VITE_IS_DEV_SERVER) {
        resolveScanPromise();
        return;
      }

      runDirectivesScan({
        rootConfig: server.config,
        environments: server.environments,
        clientFiles,
        serverFiles,
        entries: [workerEntryPathname],
        esbuildOptions,
      })
        .then(() => {
          writeFileSync(
            VENDOR_CLIENT_BARREL_PATH,
            generateVendorBarrelContent(clientFiles, projectRootDir),
          );
          writeFileSync(
            VENDOR_SERVER_BARREL_PATH,
            generateVendorBarrelContent(serverFiles, projectRootDir),
          );
          resolveScanPromise();
        })
        .catch((error) => {
          rejectScanPromise(error);
        });

      server.middlewares.use(async (_req, _res, next) => {
        await scanPromise;
        next();
      });
    },

    configResolved(config) {
      if (config.command !== "serve") {
        resolveScanPromise();
        return;
      }

      mkdirSync(path.dirname(APP_CLIENT_BARREL_PATH), { recursive: true });
      writeFileSync(APP_CLIENT_BARREL_PATH, "");
      mkdirSync(path.dirname(APP_SERVER_BARREL_PATH), { recursive: true });
      writeFileSync(APP_SERVER_BARREL_PATH, "");

      mkdirSync(path.dirname(VENDOR_CLIENT_BARREL_PATH), { recursive: true });
      writeFileSync(VENDOR_CLIENT_BARREL_PATH, "");
      mkdirSync(path.dirname(VENDOR_SERVER_BARREL_PATH), { recursive: true });
      writeFileSync(VENDOR_SERVER_BARREL_PATH, "");

      for (const [envName, env] of Object.entries(config.environments || {})) {
        env.optimizeDeps ??= {};
        env.optimizeDeps.include ??= [];
        env.optimizeDeps.include.push(
          VENDOR_CLIENT_BARREL_EXPORT_PATH,
          VENDOR_SERVER_BARREL_EXPORT_PATH,
        );
        const entries = (env.optimizeDeps.entries = castArray(
          env.optimizeDeps.entries ?? [],
        ));
        entries.push(
          VENDOR_CLIENT_BARREL_EXPORT_PATH,
          VENDOR_SERVER_BARREL_EXPORT_PATH,
        );

        if (envName === "client" || envName === "ssr") {
          entries.push(APP_CLIENT_BARREL_PATH);
        } else if (envName === "worker") {
          entries.push(APP_SERVER_BARREL_PATH);
        }

        env.optimizeDeps.esbuildOptions ??= {};
        env.optimizeDeps.esbuildOptions.plugins ??= [];
        env.optimizeDeps.esbuildOptions.plugins.unshift({
          name: "rwsdk:app-barrel-blocker",
          setup(build) {
            const appBarrelPaths = [
              APP_CLIENT_BARREL_PATH,
              APP_SERVER_BARREL_PATH,
            ];
            const vendorBarrelPaths = [
              VENDOR_CLIENT_BARREL_PATH,
              VENDOR_SERVER_BARREL_PATH,
            ];
            const barrelPaths = [...appBarrelPaths, ...vendorBarrelPaths];
            const escapeRegExp = (s: string) =>
              s.replace(/[\\^$*+?.()|[\]{}]/g, "\\$&");
            const barrelFilter = new RegExp(
              `(${barrelPaths.map(escapeRegExp).join("|")})$`,
            );

            build.onResolve({ filter: /.*/ }, async (args: any) => {
              // Block all resolutions until the scan is complete.
              await scanPromise;

              // Handle stable vendor barrel specifiers by redirecting them to
              // the in-memory temp barrel files. This lets Vite rewrite the
              // specifier to its optimized dependency bundle while still serving
              // our generated content.
              const isClientBarrelPath =
                args.path === VENDOR_CLIENT_BARREL_EXPORT_PATH ||
                args.path === SDK_VENDOR_CLIENT_BARREL_PATH ||
                args.path.endsWith("/__vendor_client_barrel.dev-virtual.js");
              const isServerBarrelPath =
                args.path === VENDOR_SERVER_BARREL_EXPORT_PATH ||
                args.path === SDK_VENDOR_SERVER_BARREL_PATH ||
                args.path.endsWith("/__vendor_server_barrel.dev-virtual.js");

              if (isClientBarrelPath) {
                return {
                  path: VENDOR_CLIENT_BARREL_PATH,
                  namespace: "rwsdk-barrel-ns",
                };
              }
              if (isServerBarrelPath) {
                return {
                  path: VENDOR_SERVER_BARREL_PATH,
                  namespace: "rwsdk-barrel-ns",
                };
              }

              // Handle barrel files (app + vendor)
              if (barrelFilter.test(args.path)) {
                return {
                  path: args.path,
                  namespace: "rwsdk-barrel-ns",
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
              { filter: /__vendor_(client|server)_barrel\.dev-virtual\.js$/ },
              async (args) => {
                await scanPromise;
                const isServerBarrel = args.path.includes("server-barrel");
                const files = isServerBarrel ? serverFiles : clientFiles;
                return {
                  contents: generateVendorBarrelContent(files, projectRootDir),
                  loader: "js",
                };
              },
            );

            build.onLoad(
              { filter: /.*/, namespace: "rwsdk-barrel-ns" },
              (args) => {
                const isServerBarrel = args.path.includes("server-barrel");
                const isVendorBarrel = args.path.includes("vendor");

                if (isVendorBarrel) {
                  const files = isServerBarrel ? serverFiles : clientFiles;
                  const content = generateVendorBarrelContent(
                    files,
                    projectRootDir,
                  );
                  return {
                    contents: content,
                    loader: "js",
                  };
                }

                const files = isServerBarrel ? serverFiles : clientFiles;
                const content = generateAppBarrelContent(files, projectRootDir);
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
