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
  getOptimizeDepsExcludePatternsByEnv,
  isExcludedFromOptimization,
  resolveOptimizeDepsExcludesByEnv,
} from "./resolveOptimizeDepsExcludes.mjs";
import {
  ConfigurableEsbuildOptions,
  runDirectivesScan,
} from "./runDirectivesScan.mjs";

export const generateVendorBarrelContent = (
  files: Set<string>,
  projectRootDir: string,
  excludedRoots: string[] = [],
) => {
  const imports = [...files]
    .filter(
      (file) =>
        file.includes("node_modules") &&
        !isExcludedFromOptimization(file, excludedRoots, projectRootDir),
    )
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
      .filter(
        (file) =>
          file.includes("node_modules") &&
          !isExcludedFromOptimization(file, excludedRoots, projectRootDir),
      )
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
  excludedRoots: string[] = [],
) => {
  return [...files]
    .filter(
      (file) =>
        !file.includes("node_modules") ||
        isExcludedFromOptimization(file, excludedRoots, projectRootDir),
    )
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
  let excludedRootsByEnv: Record<string, string[]> = {};
  let clientBarrelExcludedRoots: string[] = [];
  let serverBarrelExcludedRoots: string[] = [];
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

  const appBarrelPaths = [APP_CLIENT_BARREL_PATH, APP_SERVER_BARREL_PATH];
  const slugifyOptimizeEntry = (id: string) =>
    id.replaceAll("/", "_").replaceAll(".", "__");
  const VENDOR_CLIENT_BARREL_OPTIMIZED_ID = slugifyOptimizeEntry(
    VENDOR_CLIENT_BARREL_EXPORT_PATH,
  );
  const VENDOR_SERVER_BARREL_OPTIMIZED_ID = slugifyOptimizeEntry(
    VENDOR_SERVER_BARREL_EXPORT_PATH,
  );
  const escapeRegExp = (s: string) => s.replace(/[\\^$*+?.()|[\]{}]/g, "\\$&");
  const appBarrelFilter = new RegExp(
    `(${appBarrelPaths.map(escapeRegExp).join("|")})$`,
  );
  const BARREL_PREFIX = "\0rwsdk-app-barrel:";

  const createAppBarrelBlockerPlugin = (
    clientExcludedRoots: string[],
    serverExcludedRoots: string[],
  ) => ({
    name: "rwsdk:app-barrel-blocker",
    async resolveId(id: string) {
      await scanPromise;

      // Handle stable vendor barrel specifiers by redirecting them to
      // the in-memory temp barrel files. This lets Vite rewrite the
      // specifier to its optimized dependency bundle while still serving
      // our generated content.
      const isClientBarrelPath =
        id === VENDOR_CLIENT_BARREL_EXPORT_PATH ||
        id === VENDOR_CLIENT_BARREL_OPTIMIZED_ID ||
        id === SDK_VENDOR_CLIENT_BARREL_PATH ||
        id.endsWith("/__vendor_client_barrel.dev-virtual.js");
      const isServerBarrelPath =
        id === VENDOR_SERVER_BARREL_EXPORT_PATH ||
        id === VENDOR_SERVER_BARREL_OPTIMIZED_ID ||
        id === SDK_VENDOR_SERVER_BARREL_PATH ||
        id.endsWith("/__vendor_server_barrel.dev-virtual.js");

      if (isClientBarrelPath) {
        return VENDOR_CLIENT_BARREL_PATH;
      }
      if (isServerBarrelPath) {
        return VENDOR_SERVER_BARREL_PATH;
      }

      // Handle app barrel files
      if (appBarrelFilter.test(id)) {
        return `${BARREL_PREFIX}${id}`;
      }

      // context(justinvdm, 11 Sep 2025): Prevent Vite from
      // externalizing our application files. If we don't, paths
      // imported in our application barrel files will be marked as
      // external, and thus not scanned for dependencies.
      if (
        id.startsWith("/") &&
        (id.includes("/src/") || id.includes("/generated/")) &&
        !id.includes("node_modules")
      ) {
        return id;
      }
    },
    load(id: string) {
      // Handle vendor barrels
      if (
        id === VENDOR_CLIENT_BARREL_PATH ||
        id === VENDOR_SERVER_BARREL_PATH
      ) {
        const isServerBarrel = id.includes("server-barrel");
        const files = isServerBarrel ? serverFiles : clientFiles;
        return generateVendorBarrelContent(
          files,
          projectRootDir,
          isServerBarrel ? serverExcludedRoots : clientExcludedRoots,
        );
      }

      // Handle app barrels
      if (id.startsWith(BARREL_PREFIX)) {
        const barrelPath = id.slice(BARREL_PREFIX.length);
        const isServerBarrel = barrelPath.includes("app-server-barrel");
        const files = isServerBarrel ? serverFiles : clientFiles;
        return generateAppBarrelContent(
          files,
          projectRootDir,
          isServerBarrel ? serverExcludedRoots : clientExcludedRoots,
        );
      }
    },
  });

  const addUnique = (items: string[], value: string) => {
    if (!items.includes(value)) {
      items.push(value);
    }
  };

  const configureOptimizeDeps = (
    envName: string,
    env: any,
    clientExcludedRoots: string[],
    serverExcludedRoots: string[],
  ) => {
    env.optimizeDeps ??= {};
    env.optimizeDeps.include ??= [];
    addUnique(env.optimizeDeps.include, VENDOR_CLIENT_BARREL_EXPORT_PATH);
    addUnique(env.optimizeDeps.include, VENDOR_SERVER_BARREL_EXPORT_PATH);

    const entries = (env.optimizeDeps.entries = castArray(
      env.optimizeDeps.entries ?? [],
    ));
    addUnique(entries, VENDOR_CLIENT_BARREL_EXPORT_PATH);
    addUnique(entries, VENDOR_SERVER_BARREL_EXPORT_PATH);

    if (envName === "client" || envName === "ssr") {
      addUnique(entries, APP_CLIENT_BARREL_PATH);
    } else if (envName === "worker") {
      addUnique(entries, APP_SERVER_BARREL_PATH);
    }

    env.optimizeDeps.rolldownOptions ??= {};
    env.optimizeDeps.rolldownOptions.plugins ??= [];

    if (
      !env.optimizeDeps.rolldownOptions.plugins.some(
        (plugin: { name?: string }) =>
          plugin.name === "rwsdk:app-barrel-blocker",
      )
    ) {
      env.optimizeDeps.rolldownOptions.plugins.unshift(
        createAppBarrelBlockerPlugin(clientExcludedRoots, serverExcludedRoots),
      );
    }
  };

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
        return generateVendorBarrelContent(
          clientFiles,
          projectRootDir,
          clientBarrelExcludedRoots,
        );
      }
      if (isServerBarrel) {
        return generateVendorBarrelContent(
          serverFiles,
          projectRootDir,
          serverBarrelExcludedRoots,
        );
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
            generateVendorBarrelContent(
              clientFiles,
              projectRootDir,
              clientBarrelExcludedRoots,
            ),
          );
          writeFileSync(
            VENDOR_SERVER_BARREL_PATH,
            generateVendorBarrelContent(
              serverFiles,
              projectRootDir,
              serverBarrelExcludedRoots,
            ),
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
      // context(chrisvdm, 2026-07-02): This hook must stay synchronous. Vite 7
      // does not await async configResolved hooks before running later plugins,
      // including the SDK's Vite 7 compat shim that translates
      // optimizeDeps.rolldownOptions.plugins into esbuild plugins. If we add
      // our app-barrel-blocker plugin after that shim has run, the optimizer
      // never sees it and the dev vendor barrel stays empty.
      excludedRootsByEnv = resolveOptimizeDepsExcludesByEnv(
        getOptimizeDepsExcludePatternsByEnv(config),
        projectRootDir,
      );
      clientBarrelExcludedRoots = [
        ...new Set([
          ...(excludedRootsByEnv.client ?? []),
          ...(excludedRootsByEnv.ssr ?? []),
        ]),
      ];
      serverBarrelExcludedRoots = [...(excludedRootsByEnv.worker ?? [])];

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
        configureOptimizeDeps(
          envName,
          env,
          clientBarrelExcludedRoots,
          serverBarrelExcludedRoots,
        );
      }
    },
  };
};

const castArray = <T,>(value: T | T[]): T[] => {
  return Array.isArray(value) ? value : [value];
};
