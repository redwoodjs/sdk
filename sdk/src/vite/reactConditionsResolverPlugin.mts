import { Plugin } from "vite";
import fs from "fs/promises";
import debug from "debug";
import { ROOT_DIR } from "../lib/constants.mjs";
import enhancedResolve from "enhanced-resolve";
import { ensureAliasArray } from "./ensureAliasArray.mjs";

const log = debug("rwsdk:vite:react-conditions-resolver-plugin");

export const ENV_REACT_IMPORTS = {
  worker: [
    "react",
    "react-dom",
    "react/jsx-runtime",
    "react/jsx-dev-runtime",
    "react-server-dom-webpack/server.edge",
  ],
  ssr: [
    "react",
    "react-dom",
    "react/jsx-runtime",
    "react/jsx-dev-runtime",
    "react-dom/server.edge",
    "react-dom/server",
    "react-server-dom-webpack/client.edge",
  ],
  client: [
    "react",
    "react-dom",
    "react-dom/client",
    "react/jsx-runtime",
    "react/jsx-dev-runtime",
    "react-server-dom-webpack/client.browser",
    "react-server-dom-webpack/client.edge",
  ],
};

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

export const ENV_IMPORT_MAPPINGS = Object.fromEntries(
  Object.keys(ENV_RESOLVERS).map((env) => [
    env,
    resolveEnvImportMappings(env as keyof typeof ENV_RESOLVERS),
  ]),
);

function resolveEnvImportMappings(env: keyof typeof ENV_RESOLVERS) {
  process.env.VERBOSE &&
    log("Resolving environment import mappings for env=%s", env);

  const mappings = new Map<string, string>();
  const reactImports = ENV_REACT_IMPORTS[env];

  for (const importRequest of reactImports) {
    process.env.VERBOSE &&
      log("Resolving import request=%s for env=%s", importRequest, env);

    let resolved: string | false = false;

    try {
      resolved = ENV_RESOLVERS[env](ROOT_DIR, importRequest);
      process.env.VERBOSE &&
        log(
          "Successfully resolved %s to %s for env=%s",
          importRequest,
          resolved,
          env,
        );
    } catch {
      process.env.VERBOSE &&
        log("Failed to resolve %s for env=%s", importRequest, env);
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
        process.env.VERBOSE &&
          log(
            "ESBuild resolving %s for env=%s, args=%O",
            args.path,
            envName,
            args,
          );

        const resolved = mappings.get(args.path);

        if (resolved && args.importer !== "") {
          process.env.VERBOSE &&
            log(
              "ESBuild resolving %s -> %s for env=%s",
              args.path,
              resolved,
              envName,
            );
          if (args.path === "react-server-dom-webpack/client.edge") {
            return;
          }
          return {
            path: resolved,
          };
        } else {
          process.env.VERBOSE &&
            log(
              "ESBuild no resolution found for %s for env=%s",
              args.path,
              envName,
            );
        }
      });
    },
  };
}

export const reactConditionsResolverPlugin = (): Plugin[] => {
  log("Initializing react conditions resolver plugin");
  let isBuild = false;

  return [
    {
      name: "rwsdk:react-conditions-resolver:config",
      enforce: "post",

      config(config, { command }) {
        isBuild = command === "build";
        log("Configuring plugin for command=%s", command);
      },

      configResolved(config) {
        log("Setting up resolve aliases and optimizeDeps for each environment");

        // Set up aliases and optimizeDeps for each environment
        for (const [envName, mappings] of Object.entries(ENV_IMPORT_MAPPINGS)) {
          const reactImports =
            ENV_REACT_IMPORTS[envName as keyof typeof ENV_REACT_IMPORTS];

          // Ensure environment config exists
          if (!(config as any).environments) {
            (config as any).environments = {};
          }

          if (!(config as any).environments[envName]) {
            (config as any).environments[envName] = {};
          }

          const envConfig = (config as any).environments[envName];

          const esbuildPlugin = createEsbuildResolverPlugin(envName);
          if (esbuildPlugin && mappings) {
            envConfig.optimizeDeps ??= {};
            envConfig.optimizeDeps.esbuildOptions ??= {};
            envConfig.optimizeDeps.esbuildOptions.define ??= {};
            envConfig.optimizeDeps.esbuildOptions.define[
              "process.env.NODE_ENV"
            ] = JSON.stringify(process.env.NODE_ENV ?? "production");
            envConfig.optimizeDeps.esbuildOptions.plugins ??= [];
            envConfig.optimizeDeps.esbuildOptions.plugins.push(esbuildPlugin);

            envConfig.optimizeDeps.include ??= [];
            envConfig.optimizeDeps.include.push(...reactImports);

            log(
              "Added esbuild plugin and optimizeDeps includes for environment: %s",
              envName,
            );
          }

          const aliases = ensureAliasArray(envConfig);

          for (const [find, replacement] of mappings) {
            const findRegex = new RegExp(
              `^${find.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&")}$`,
            );
            aliases.push({ find: findRegex, replacement });
            log("Added alias for env=%s: %s -> %s", envName, find, replacement);
          }

          log(
            "Environment %s configured with %d aliases and %d optimizeDeps includes",
            envName,
            mappings.size,
            reactImports.length,
          );
        }
      },
    },
    {
      name: "rwsdk:react-conditions-resolver:resolveId",
      enforce: "pre",
      async resolveId(
        id: string,
        importer: string | undefined,
      ): Promise<string | undefined> {
        if (!isBuild) {
          return;
        }

        const envName = this.environment?.name;

        if (!envName) {
          return;
        }

        process.env.VERBOSE &&
          log(
            "Resolving id=%s, environment=%s, importer=%s",
            id,
            envName,
            importer,
          );

        const mappings = ENV_IMPORT_MAPPINGS[envName];

        if (!mappings) {
          process.env.VERBOSE &&
            log("No mappings found for environment: %s", envName);
          return;
        }

        const resolved = mappings.get(id);

        if (resolved) {
          log("Resolved %s -> %s for env=%s", id, resolved, envName);
          return resolved;
        }

        process.env.VERBOSE &&
          log("No resolution found for id=%s in env=%s", id, envName);
      },
    },
  ];
};
