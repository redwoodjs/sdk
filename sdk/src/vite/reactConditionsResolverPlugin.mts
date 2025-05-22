import { resolve } from "path";
import { Plugin, EnvironmentOptions } from "vite";
import { ROOT_DIR } from "../lib/constants.mjs";
import debug from "debug";
import { pathExists } from "fs-extra";
import enhancedResolve from "enhanced-resolve";
import { VENDOR_DIST_DIR } from "../lib/constants.mjs";
import { createRequire } from "node:module";
import { ensureAliasArray } from "./ensureAliasArray.mjs";

const log = debug("rwsdk:vite:react-conditions");

// Define package sets for each environment
const WORKER_PACKAGES = [
  "react",
  "react-dom/server.edge",
  "react-dom/server",
  "react-dom",
  "react/jsx-runtime",
  "react/jsx-dev-runtime",
  "react-server-dom-webpack/client.browser",
  "react-server-dom-webpack/client.edge",
  "react-server-dom-webpack/server.edge",
];

const CLIENT_PACKAGES = [
  "react",
  "react-dom/client",
  "react-dom",
  "react/jsx-runtime",
  "react/jsx-dev-runtime",
  "react-server-dom-webpack/client.browser",
  "react-server-dom-webpack/client.edge",
  "react-server-dom-webpack/server.edge",
];

// Skip react-server condition for these packages
const SKIP_REACT_SERVER = [
  "react-dom/server",
  "react-dom/client",
  "react-dom/server.edge",
  "react-dom/server.browser",
];

// Global server packages that need aliases regardless of environment
const GLOBAL_SERVER_PACKAGES = [
  "react-dom/server.edge",
  "react-dom/server",
  "react-server-dom-webpack/server.edge",
  "react-server-dom-webpack/client.edge",
];

export const reactConditionsResolverPlugin = async ({
  mode = "development",
  command = "serve",
}: {
  projectRootDir: string;
  mode?: "development" | "production";
  command?: "build" | "serve";
}): Promise<Plugin> => {
  log(
    "Initializing React conditions resolver plugin in %s mode for %s",
    mode,
    command,
  );

  const vendorDir = VENDOR_DIST_DIR;
  const sdkRequire = createRequire(ROOT_DIR);

  const workerResolver = enhancedResolve.create.sync({
    conditionNames: ["react-server", "workerd", "worker", "edge", "default"],
  });

  const clientResolver = enhancedResolve.create.sync({
    conditionNames: ["browser", "default"],
  });

  const skipReactServerResolver = enhancedResolve.create.sync({
    conditionNames: ["workerd", "worker", "edge", "default"],
  });

  const resolveWithConditions = async (
    packageName: string,
    environment: string,
  ) => {
    if (packageName === "react") {
      const modePath = resolve(vendorDir, `react.${mode}.js`);
      if (await pathExists(modePath)) {
        log("Using custom %s mode build for %s", mode, packageName);
        return modePath;
      }
    }

    try {
      let resolver;

      if (environment === "worker") {
        if (SKIP_REACT_SERVER.includes(packageName)) {
          resolver = skipReactServerResolver;
          log("Using skipReactServer resolver for %s", packageName);
        } else {
          resolver = workerResolver;
          log("Using worker resolver with react-server for %s", packageName);
        }
      } else {
        resolver = clientResolver;
        log("Using client resolver for %s", packageName);
      }

      const resolved = resolver(ROOT_DIR, packageName);
      if (resolved) {
        log("Resolved %s to %s using enhanced-resolve", packageName, resolved);
        return resolved;
      }
    } catch (error) {
      log("Enhanced resolution failed for %s: %o", packageName, error);
    }

    try {
      const resolved = sdkRequire.resolve(packageName);
      log("Standard resolution for %s: %s", packageName, resolved);
      return resolved;
    } catch (fallbackError) {
      log("All resolution failed for %s: %o", packageName, fallbackError);
      throw new Error(`Failed to resolve ${packageName}`);
    }
  };

  const generateImports = async (packages: string[], env: string) => {
    const imports: Record<string, string> = {};
    for (const pkg of packages) {
      imports[pkg] = await resolveWithConditions(pkg, env);
    }
    return imports;
  };

  // Generate import mappings for both environments
  const workerImports = await generateImports(WORKER_PACKAGES, "worker");
  const clientImports = await generateImports(CLIENT_PACKAGES, "client");

  // Log the resolved paths
  const logImports = (env: string, imports: Record<string, string>) => {
    log(`Resolved ${env} paths (${mode} mode):`);
    Object.entries(imports).forEach(([id, path]) => {
      log("- %s: %s", id, path);
    });
  };

  logImports("worker", workerImports);
  logImports("client", clientImports);

  const configureEnvironment = (
    name: string,
    config: EnvironmentOptions,
    imports: Record<string, string>,
  ) => {
    log(
      `Applying React conditions resolver for ${name} environment in ${mode} mode`,
    );

    (config.optimizeDeps ??= {}).esbuildOptions ??= {};

    config.optimizeDeps.esbuildOptions.define = {
      ...(config.optimizeDeps.esbuildOptions.define || {}),
      "process.env.NODE_ENV": JSON.stringify(mode),
    };

    config.optimizeDeps.include ??= [];
    config.optimizeDeps.include.push(...Object.keys(imports));

    config.resolve ??= {};

    ensureAliasArray(config);

    Object.entries(imports).forEach(([id, resolvedPath]) => {
      const exactMatchRegex = new RegExp(
        `^${id.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&")}$`,
      );

      (config.resolve as any).alias.push({
        find: exactMatchRegex,
        replacement: resolvedPath,
      });

      log(`${name}: Added alias for ${id} -> ${resolvedPath}`);
    });
  };

  return {
    name: `rwsdk:react-conditions-resolver:${mode}`,
    enforce: "post",

    config(config) {
      config.resolve ??= {};
      (config.resolve as any).alias ??= [];

      if (!Array.isArray((config.resolve as any).alias)) {
        const existingAlias = (config.resolve as any).alias;
        (config.resolve as any).alias = Object.entries(existingAlias).map(
          ([find, replacement]) => ({ find, replacement }),
        );
      }

      for (const id of GLOBAL_SERVER_PACKAGES) {
        const resolvedPath = workerImports[id];
        if (resolvedPath) {
          const exactMatchRegex = new RegExp(
            `^${id.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&")}$`,
          );
          (config.resolve as any).alias.push({
            find: exactMatchRegex,
            replacement: resolvedPath,
          });
          log(`Global: Added alias for ${id} -> ${resolvedPath}`);
        }
      }

      return config;
    },

    configEnvironment(name: string, config: EnvironmentOptions) {
      if (name === "client") {
        configureEnvironment("client", config, clientImports);
      }

      if (name === "worker") {
        configureEnvironment("worker", config, workerImports);
      }
    },
  };
};
