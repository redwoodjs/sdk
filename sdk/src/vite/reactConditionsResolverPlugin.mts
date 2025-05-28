import { Plugin } from "vite";
import debug from "debug";
import { ROOT_DIR } from "../lib/constants.mjs";
import enhancedResolve from "enhanced-resolve";

const log = debug("rwsdk:vite:react-conditions-resolver-plugin");

export const REACT_IMPORTS = [
  "react",
  "react-dom",
  "react-dom/client",
  "react/jsx-runtime",
  "react/jsx-dev-runtime",
  "react-dom/server.edge",
  "react-dom/server",
  "react-server-dom-webpack/client.browser",
  "react-server-dom-webpack/client.edge",
  "react-server-dom-webpack/server.edge",
];

export const ENV_RESOLVERS = {
  ssr: enhancedResolve.create.sync({
    conditionNames: ["workerd", "worker", "edge", "default"],
  }),

  worker: enhancedResolve.create.sync({
    conditionNames: ["react-server", "workerd", "worker", "edge", "default"],
  }),

  client: enhancedResolve.create.sync({
    conditionNames: ["browser", "default"],
  }),
};

// Create a mapping of import -> resolved path for each environment
export const ENV_IMPORT_MAPPINGS = Object.fromEntries(
  Object.keys(ENV_RESOLVERS).map((env) => [
    env,
    resolveEnvImportMappings(env as keyof typeof ENV_RESOLVERS),
  ]),
);

function resolveEnvImportMappings(env: keyof typeof ENV_RESOLVERS) {
  if (process.env.VERBOSE) {
    log("Resolving environment import mappings for env=%s", env);
  }

  const mappings = new Map<string, string>();

  for (const importRequest of REACT_IMPORTS) {
    if (process.env.VERBOSE) {
      log("Resolving import request=%s for env=%s", importRequest, env);
    }

    let resolved: string | false = false;

    try {
      resolved = ENV_RESOLVERS[env](ROOT_DIR, importRequest);
      if (process.env.VERBOSE) {
        log(
          "Successfully resolved %s to %s for env=%s",
          importRequest,
          resolved,
          env,
        );
      }
    } catch {
      if (process.env.VERBOSE) {
        log("Failed to resolve %s for env=%s", importRequest, env);
      }
    }

    if (resolved) {
      mappings.set(importRequest, resolved);
      log("Added mapping for %s -> %s in env=%s", importRequest, resolved, env);
    }
  }

  log(
    "Environment import mappings complete for env=%s: %d mappings",
    env,
    mappings.size,
  );
  return mappings;
}

function createEsbuildResolverPlugin(envName: string) {
  const mappings = ENV_IMPORT_MAPPINGS[envName];

  if (!mappings) {
    return null;
  }

  return {
    name: `rwsdk:react-conditions-resolver-esbuild-${envName}`,
    setup(build: any) {
      build.onResolve({ filter: /.*/ }, (args: any) => {
        if (process.env.VERBOSE) {
          log(
            "ESBuild resolving %s for env=%s, args=%O",
            args.path,
            envName,
            args,
          );
        }

        const resolved = mappings.get(args.path);

        if (resolved) {
          if (process.env.VERBOSE) {
            log(
              "ESBuild resolving %s -> %s for env=%s",
              args.path,
              resolved,
              envName,
            );
          }
          return { path: resolved };
        }
      });
    },
  };
}

export const reactConditionsResolverPlugin = async (): Promise<Plugin> => {
  log("Initializing react conditions resolver plugin");
  let isBuild = false;

  return {
    name: "rwsdk:react-conditions-resolver",
    enforce: "post",

    config(config, { command }) {
      isBuild = command === "build";
      log("Configuring plugin for command=%s", command);

      // Add esbuild plugins for each environment
      for (const envName of Object.keys(ENV_IMPORT_MAPPINGS)) {
        const esbuildPlugin = createEsbuildResolverPlugin(envName);
        const mappings = ENV_IMPORT_MAPPINGS[envName];

        if (esbuildPlugin && mappings) {
          // Add to environment-specific optimizeDeps
          if (!config.environments) {
            config.environments = {};
          }

          if (!config.environments[envName]) {
            config.environments[envName] = {};
          }

          const envConfig = config.environments[envName];
          envConfig.optimizeDeps ??= {};
          envConfig.optimizeDeps.esbuildOptions ??= {};
          envConfig.optimizeDeps.esbuildOptions.plugins ??= [];
          envConfig.optimizeDeps.esbuildOptions.plugins.push(esbuildPlugin);
          envConfig.optimizeDeps.include ??= [];

          log("Added esbuild plugin for environment: %s", envName);
        }
      }
    },

    async resolveId(id, importer) {
      if (!isBuild) {
        return;
      }

      const envName = this.environment?.name;

      if (!envName) {
        return;
      }

      if (process.env.VERBOSE) {
        log(
          "Resolving id=%s, environment=%s, importer=%s",
          id,
          envName,
          importer,
        );
      }

      const mappings = ENV_IMPORT_MAPPINGS[envName];

      if (!mappings) {
        if (process.env.VERBOSE) {
          log("No mappings found for environment: %s", envName);
        }
        return;
      }

      const resolved = mappings.get(id);

      if (resolved) {
        log("Resolved %s -> %s for env=%s", id, resolved, envName);
        return resolved;
      }

      if (process.env.VERBOSE) {
        log("No resolution found for id=%s in env=%s", id, envName);
      }
    },
  };
};
