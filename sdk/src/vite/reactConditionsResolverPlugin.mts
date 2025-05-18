import { resolve } from "path";
import { Plugin, EnvironmentOptions } from "vite";
import { ROOT_DIR } from "../lib/constants.mjs";
import debug from "debug";
import { pathExists } from "fs-extra";
import enhancedResolve from "enhanced-resolve";
import { createRequire } from "node:module";
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
    ":react-conditions-resolver:Initializing React conditions resolver plugin in :mode: mode for :command:",
    mode,
    command,
  );

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
    try {
      let resolver;

      if (environment === "worker") {
        if (SKIP_REACT_SERVER.includes(packageName)) {
          resolver = skipReactServerResolver;
          log(
            ":react-conditions-resolver:Using skipReactServer resolver for :packageName:",
          );
        } else {
          resolver = workerResolver;
          log(
            ":react-conditions-resolver:Using worker resolver with react-server for :packageName:",
          );
        }
      } else {
        resolver = clientResolver;
        log(
          ":react-conditions-resolver:Using client resolver for :packageName:",
        );
      }

      const resolved = resolver(ROOT_DIR, packageName);
      if (resolved) {
        log(
          ":react-conditions-resolver:Resolved :packageName: to :resolved: using enhanced-resolve",
        );
        return resolved;
      }
    } catch (error) {
      log(
        ":react-conditions-resolver:Enhanced resolution failed for :packageName: :error:",
        error,
      );
    }

    try {
      const resolved = sdkRequire.resolve(packageName);
      log(
        ":react-conditions-resolver:Standard resolution for :packageName: :resolved:",
        resolved,
      );
      return resolved;
    } catch (fallbackError) {
      log(
        ":react-conditions-resolver:All resolution failed for :packageName: :fallbackError:",
        fallbackError,
      );
      throw new Error(`Failed to resolve :packageName:`);
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
    log(":react-conditions-resolver:Resolved :env: paths (:mode: mode):");
    Object.entries(imports).forEach(([id, path]) => {
      log("- :id: : path:");
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
      ":react-conditions-resolver:Applying React conditions resolver for :name: environment in :mode: mode",
    );

    (config.optimizeDeps ??= {}).esbuildOptions ??= {};

    config.optimizeDeps.esbuildOptions.define = {
      ...(config.optimizeDeps.esbuildOptions.define || {}),
      "process.env.NODE_ENV": JSON.stringify(mode),
    };

    config.optimizeDeps.include ??= [];
    config.optimizeDeps.include.push(...Object.keys(imports));

    config.resolve ??= {};

    (config.resolve as any).alias ??= [];

    if (!Array.isArray((config.resolve as any).alias)) {
      const existingAlias = (config.resolve as any).alias;
      (config.resolve as any).alias = Object.entries(existingAlias).map(
        ([find, replacement]) => ({ find, replacement }),
      );
    }

    Object.entries(imports).forEach(([id, resolvedPath]) => {
      const exactMatchRegex = new RegExp(
        `^${id.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&")}$`,
      );

      (config.resolve as any).alias.unshift({
        find: exactMatchRegex,
        replacement: resolvedPath,
      });

      log(":react-conditions-resolver:Added alias for :id: -> :resolvedPath:");
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
          log(
            ":react-conditions-resolver:Global: Added alias for :id: -> :resolvedPath:",
          );
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
