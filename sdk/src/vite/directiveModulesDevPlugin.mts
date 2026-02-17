import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import os from "os";
import path from "path";
import { Plugin } from "vite";
import {
  VENDOR_CLIENT_BARREL_EXPORT_PATH,
  VENDOR_CLIENT_BARREL_PATH,
  VENDOR_SERVER_BARREL_EXPORT_PATH,
  VENDOR_SERVER_BARREL_PATH,
} from "../lib/constants.mjs";
import { normalizeModulePath } from "../lib/normalizeModulePath.mjs";
import { runDirectivesScan } from "./runDirectivesScan.mjs";

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
}: {
  clientFiles: Set<string>;
  serverFiles: Set<string>;
  projectRootDir: string;
  workerEntryPathname: string;
}): Plugin => {
  const { promise: scanPromise, resolve: resolveScanPromise } =
    Promise.withResolvers<void>();

  const tempDir = mkdtempSync(path.join(os.tmpdir(), "rwsdk-"));
  const APP_CLIENT_BARREL_PATH = path.join(tempDir, "app-client-barrel.js");
  const APP_SERVER_BARREL_PATH = path.join(tempDir, "app-server-barrel.js");

  return {
    name: "rwsdk:directive-modules-dev",
    enforce: "pre",

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
      }).then(() => {
        // context(justinvdm, 11 Sep 2025): For vendor barrels, we write the
        // files directly to disk after the scan. For app barrels, we use a
        // more complex esbuild plugin to provide content in-memory. This is
        // because app barrels require special handling to prevent Vite from
        // marking application code as `external: true`. Vendor barrels do not
        // have this requirement and a simpler, direct-write approach is more
        // stable.
        const vendorClientBarrelContent = generateVendorBarrelContent(
          clientFiles,
          projectRootDir,
        );
        writeFileSync(VENDOR_CLIENT_BARREL_PATH, vendorClientBarrelContent);

        const vendorServerBarrelContent = generateVendorBarrelContent(
          serverFiles,
          projectRootDir,
        );
        writeFileSync(VENDOR_SERVER_BARREL_PATH, vendorServerBarrelContent);

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
        const entries = (env.optimizeDeps.entries = castArray(
          env.optimizeDeps.entries ?? [],
        ));
        env.optimizeDeps.include.push(
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
            const appBarrelFilter = new RegExp(
              `(${appBarrelPaths
                .map((p) => p.replace(/\\/g, "\\\\"))
                .join("|")})$`,
            );

            build.onResolve({ filter: /.*/ }, async (args: any) => {
              // Block all resolutions until the scan is complete.
              await scanPromise;

              // Handle app barrel files
              if (appBarrelFilter.test(args.path)) {
                return {
                  path: args.path,
                  namespace: "rwsdk-app-barrel-ns",
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
