import { Plugin } from "vite";
import fs from "fs/promises";
import debug from "debug";
import { ROOT_DIR } from "../lib/constants.mjs";
import enhancedResolve from "enhanced-resolve";
import { ensureAliasArray } from "./ensureAliasArray.mjs";

const log = debug("rwsdk:vite:react-conditions-resolver-plugin");

const REACT_PREFIXES = ["react", "react-dom", "react-server-dom-webpack"];

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

function resolveReactImport(
  id: string,
  envName: keyof typeof ENV_RESOLVERS,
  projectRootDir: string,
  isReactImportKnown = false,
): string | undefined {
  if (!isReactImportKnown) {
    const isReactImport = REACT_PREFIXES.some(
      (prefix) => id === prefix || id.startsWith(`${prefix}/`),
    );
    if (!isReactImport) {
      return undefined;
    }
  }

  let resolved: string | undefined;

  try {
    resolved = ENV_RESOLVERS[envName](projectRootDir, id) || undefined;
    process.env.VERBOSE &&
      log(
        "Successfully resolved %s to %s for env=%s from project root",
        id,
        resolved,
        envName,
      );
  } catch {
    process.env.VERBOSE && log("Failed to resolve %s for env=%s", id, envName);
  }

  return resolved;
}

function resolveEnvImportMappings(
  env: keyof typeof ENV_RESOLVERS,
  projectRootDir: string,
) {
  process.env.VERBOSE &&
    log("Resolving environment import mappings for env=%s", env);

  const mappings = new Map<string, string>();
  const reactImports = ENV_REACT_IMPORTS[env];

  for (const importRequest of reactImports) {
    const resolved = resolveReactImport(
      importRequest,
      env,
      projectRootDir,
      true,
    );
    if (resolved) {
      mappings.set(importRequest, resolved);
      process.env.VERBOSE &&
        log(
          "Added mapping for %s -> %s in env=%s",
          importRequest,
          resolved,
          env,
        );
    }
  }

  process.env.VERBOSE &&
    log(
      "Environment import mappings complete for env=%s: %d mappings",
      env,
      mappings.size,
    );
  return mappings;
}

export const reactConditionsResolverPlugin = ({
  projectRootDir,
}: {
  projectRootDir: string;
}): Plugin[] => {
  log("Initializing react conditions resolver plugin");
  let isBuild = false;

  const ENV_IMPORT_MAPPINGS = Object.fromEntries(
    Object.keys(ENV_RESOLVERS).map((env) => [
      env,
      resolveEnvImportMappings(
        env as keyof typeof ENV_RESOLVERS,
        projectRootDir,
      ),
    ]),
  );

  // Log a clean summary instead of all the individual mappings
  const totalMappings = Object.values(ENV_IMPORT_MAPPINGS).reduce(
    (sum, mappings) => sum + (mappings as Map<string, string>).size,
    0,
  );
  log(
    "React conditions resolver configured with %d total mappings across %d environments",
    totalMappings,
    Object.keys(ENV_IMPORT_MAPPINGS).length,
  );

  function createEsbuildResolverPlugin(
    envName: string,
    mappings: Map<string, string>,
  ) {
    if (!mappings) {
      return null;
    }

    return {
      name: `rwsdk:react-conditions-resolver-esbuild-${envName}`,
      setup(build: any) {
        build.onResolve({ filter: /.*/ }, (args: any) => {
          let resolved: string | undefined = mappings.get(args.path);

          if (!resolved) {
            resolved = resolveReactImport(
              args.path,
              envName as keyof typeof ENV_RESOLVERS,
              projectRootDir,
            );
          }

          if (resolved && args.importer !== "") {
            if (args.path === "react-server-dom-webpack/client.edge") {
              return;
            }
            return {
              path: resolved,
            };
          }
        });
      },
    };
  }

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

          const esbuildPlugin = createEsbuildResolverPlugin(
            envName,
            mappings as Map<string, string>,
          );
          if (esbuildPlugin && mappings) {
            envConfig.optimizeDeps ??= {};
            envConfig.optimizeDeps.esbuildOptions ??= {};
            envConfig.optimizeDeps.esbuildOptions.define ??= {};
            envConfig.optimizeDeps.esbuildOptions.define[
              "process.env.NODE_ENV"
            ] = JSON.stringify(process.env.NODE_ENV);
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

          for (const [find, replacement] of mappings as Map<string, string>) {
            const findRegex = new RegExp(
              `^${find.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&")}$`,
            );
            aliases.push({ find: findRegex, replacement });
            process.env.VERBOSE &&
              log(
                "Added alias for env=%s: %s -> %s",
                envName,
                find,
                replacement,
              );
          }

          log(
            "Environment %s configured with %d aliases and %d optimizeDeps includes",
            envName,
            (mappings as Map<string, string>).size,
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
        // Skip during directive scanning to avoid performance issues
        if (process.env.RWSDK_DIRECTIVE_SCAN_ACTIVE) {
          return;
        }

        if (!isBuild) {
          return;
        }

        const envName = this.environment?.name;

        if (!envName) {
          return;
        }

        const mappings =
          ENV_IMPORT_MAPPINGS[envName as keyof typeof ENV_IMPORT_MAPPINGS];

        if (!mappings) {
          process.env.VERBOSE &&
            log("No mappings found for environment: %s", envName);
          return;
        }

        let resolved: string | undefined = (
          mappings as Map<string, string>
        ).get(id);

        if (!resolved) {
          resolved = resolveReactImport(
            id,
            envName as keyof typeof ENV_RESOLVERS,
            projectRootDir,
          );
        }

        if (resolved) {
          process.env.VERBOSE &&
            log("Resolved %s -> %s for env=%s", id, resolved, envName);
          return resolved;
        }
      },
    },
  ];
};
