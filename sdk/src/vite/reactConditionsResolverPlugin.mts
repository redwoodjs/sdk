import { Plugin, EnvironmentOptions } from "vite";
import debug from "debug";
import { ROOT_DIR } from "../lib/constants.mjs";
import enhancedResolve from "enhanced-resolve";
import { ensureAliasArray } from "./ensureAliasArray.mjs";

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

export const ENV_IMPORTS = Object.fromEntries(
  Object.keys(ENV_RESOLVERS).map((env) => [
    env,
    resolveEnvImports(env as keyof typeof ENV_RESOLVERS),
  ]),
);

function resolveEnvImports(env: keyof typeof ENV_RESOLVERS) {
  log("Resolving environment imports for env=%s", env);
  const aliases = [];
  const optimizeIncludes = [];

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
      const exactMatchRegex = new RegExp(
        `^${importRequest.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&")}$`,
      );

      aliases.push({
        find: exactMatchRegex,
        replacement: resolved,
      });

      optimizeIncludes.push(importRequest);
      log("Added alias for %s -> %s in env=%s", importRequest, resolved, env);
    }
  }

  log(
    "Environment imports resolution complete for env=%s: aliases=%d, optimizeIncludes=%d",
    env,
    aliases.length,
    optimizeIncludes.length,
  );
  return {
    aliases,
    optimizeIncludes,
  };
}

export const reactConditionsResolverPlugin = async (): Promise<Plugin> => {
  log("Initializing react conditions resolver plugin");
  return {
    name: "rwsdk:react-conditions-resolver",
    enforce: "post",

    configEnvironment(name: string, config: EnvironmentOptions) {
      if (process.env.VERBOSE) {
        log("Configuring environment: name=%s", name);
      }

      const imports = ENV_IMPORTS[name];

      if (!imports) {
        if (process.env.VERBOSE) {
          log("No imports configuration found for environment: %s", name);
        }
        return;
      }

      log(
        "Applying imports configuration for environment: %s (aliases=%d, optimizeIncludes=%d)",
        name,
        imports.aliases.length,
        imports.optimizeIncludes.length,
      );

      // context(justinvdm 27 May 2024): Setting the alias config via
      // configEnvironment allows us to have optimizeDeps use per-environment aliases, even though
      // EnvironmentOptions type doesn't have it as a property
      const aliasArray = ensureAliasArray(config);

      // Remove existing aliases that match any of the imports we're about to add
      for (let i = aliasArray.length - 1; i >= 0; i--) {
        const alias = aliasArray[i];
        const aliasFind = alias.find;

        // Check if this alias matches any of our import requests
        const matchesImport = imports.optimizeIncludes.some((importRequest) => {
          if (typeof aliasFind === "string") {
            return aliasFind === importRequest;
          } else if (aliasFind instanceof RegExp) {
            return aliasFind.test(importRequest);
          }
          return false;
        });

        if (matchesImport) {
          aliasArray.splice(i, 1);
        }
      }

      aliasArray.push(...imports.aliases);

      ((config.optimizeDeps ??= {}).include ??= []).push(
        ...imports.optimizeIncludes,
      );

      log("Environment configuration complete for: %s", name);
    },
  };
};
