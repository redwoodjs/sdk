import { Plugin, EnvironmentOptions } from "vite";
import { ROOT_DIR } from "../lib/constants.mjs";
import enhancedResolve from "enhanced-resolve";
import { ensureAliasArray } from "./ensureAliasArray.mjs";

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

export const ENV_ALIASES = Object.fromEntries(
  Object.keys(ENV_RESOLVERS).map((env) => [
    env,
    resolveEnvAliases(env as keyof typeof ENV_RESOLVERS),
  ]),
);

function resolveEnvAliases(env: keyof typeof ENV_RESOLVERS) {
  const aliases = [];

  for (const importRequest of REACT_IMPORTS) {
    let resolved: string | false = false;

    try {
      resolved = ENV_RESOLVERS[env](ROOT_DIR, importRequest);
    } catch {}

    if (resolved) {
      const exactMatchRegex = new RegExp(
        `^${resolved.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&")}$`,
      );

      aliases.push({
        find: exactMatchRegex,
        replacement: resolved,
      });
    }
  }

  return aliases;
}

export const reactConditionsResolverPlugin = async (): Promise<Plugin> => {
  return {
    name: "rwsdk:react-conditions-resolver",
    enforce: "post",

    configEnvironment(name: string, config: EnvironmentOptions) {
      const aliases = ENV_ALIASES[name];

      if (!aliases) {
        return;
      }

      // context(justinvdm 27 May 2024): Setting the alias config via
      // configEnvironment allows us to have optimizeDeps use per-environment aliases, even though
      // EnvironmentOptions type doesn't have it as a property
      ensureAliasArray(config).push(...aliases);

      ((config.optimizeDeps ??= {}).include ??= []).push(...REACT_IMPORTS);
    },
  };
};
