import { Plugin, EnvironmentOptions } from "vite";
import debug from "debug";
import { ROOT_DIR } from "../lib/constants.mjs";
import enhancedResolve from "enhanced-resolve";
import { ensureAliasArray } from "./ensureAliasArray.mjs";

const log = debug("rwsdk:vite:react-conditions-resolver-plugin");

export const ENV_CONFIGS = {
  worker: {
    imports: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "react-server-dom-webpack/server.edge",
    ],
    resolver: enhancedResolve.create.sync({
      conditionNames: ["react-server", "workerd", "worker", "edge", "default"],
    }),
  },

  ssr: {
    imports: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "react-dom/server.edge",
      "react-dom/server",
      "react-server-dom-webpack/client.edge",
    ],
    resolver: enhancedResolve.create.sync({
      conditionNames: ["workerd", "worker", "edge", "default"],
    }),
  },

  client: {
    imports: [
      "react",
      "react-dom",
      "react-dom/client",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "react-server-dom-webpack/client.browser",
    ],
    resolver: enhancedResolve.create.sync({
      conditionNames: ["browser", "default"],
    }),
  },
};

export const ENV_IMPORTS = Object.fromEntries(
  Object.keys(ENV_CONFIGS).map((env) => [
    env,
    resolveEnvImports(env as keyof typeof ENV_CONFIGS),
  ]),
);

function resolveEnvImports(env: keyof typeof ENV_CONFIGS) {
  log("Resolving environment imports for env=%s", env);
  const aliases = [];
  const optimizeIncludes = [];
  const config = ENV_CONFIGS[env];

  for (const importRequest of config.imports) {
    if (process.env.VERBOSE) {
      log("Resolving import request=%s for env=%s", importRequest, env);
    }

    let resolved: string | false = false;

    try {
      resolved = config.resolver(ROOT_DIR, importRequest);
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
      ensureAliasArray(config).push(...imports.aliases);

      ((config.optimizeDeps ??= {}).include ??= []).push(
        ...imports.optimizeIncludes,
      );

      log("Environment configuration complete for: %s", name);
    },
  };
};
