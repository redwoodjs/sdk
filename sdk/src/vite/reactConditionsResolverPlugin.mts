import { Plugin, EnvironmentOptions } from "vite";
import debug from "debug";

import { ROOT_DIR } from "../lib/constants.mjs";
import { createModuleResolver } from "./moduleResolver.mjs";

const log = debug("rwsdk:vite:react-conditions");

const ENV_CONFIG = {
  worker: {
    conditionNames: ["react-server", "workerd", "worker", "edge", "default"],
    imports: [
      "react",
      "react-dom/server.edge",
      "react-dom/server",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "react-server-dom-webpack/client.browser",
      "react-server-dom-webpack/client.edge",
      "react-server-dom-webpack/server.edge",
    ],
  },
  client: {
    conditionNames: ["browser", "default"],
    imports: [
      "react",
      "react-dom/client",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
    ],
  },
};

export const reactConditionsResolverPlugin = async ({
  mode = "development",
  command = "serve",
  projectRootDir,
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

  const contexts = Object.fromEntries(
    Object.entries(ENV_CONFIG).map(([environment, config]) => {
      return [
        environment,
        {
          ...config,
          environment,
          resolver: createModuleResolver({
            conditionNames: config.conditionNames,
            roots: [projectRootDir, ROOT_DIR],
          }),
        },
      ];
    }),
  );

  type Context = (typeof contexts)[keyof typeof contexts];

  const reactConditionsResolverEsbuildPlugin = (context: Context) => {
    return {
      name: `react-conditions-resolver-esbuild-plugin:${context.environment}`,
      setup(build: any) {
        build.onResolve({ filter: /.*/ }, (args: any) => {
          log(
            ":react-conditions-resolver:onResolve called for environment=%s with args=%O",
            args,
          );

          const found = context.imports.find((importPath) => {
            return args.path === importPath;
          });

          if (found) {
            log(
              ":react-conditions-resolver:onResolve environment=%s: Found matching import: %s",
              context.environment,
              found,
            );

            const path = context.resolver(args.path);

            if (path) {
              log(
                ":react-conditions-resolver:onResolve environment=%s: Resolved matching import: %s -> %s",
                context.environment,
                args.path,
                path,
              );
              return { path };
            } else {
              log(
                ":react-conditions-resolver:onResolve environment=%s: No result found for import: %s",
                context.environment,
                args.path,
              );
            }
          } else {
            log(
              ":react-conditions-resolver:onResolve environment=%s: No matching import found for path: %s",
              context.environment,
              args.path,
            );
          }
        });
      },
    };
  };

  const configureEnvironment = (
    context: Context,
    config: EnvironmentOptions,
  ) => {
    log(
      ":react-conditions-resolver:Applying React conditions resolver for name=%s environment in mode=%s",
      context.environment,
      mode,
    );

    (config.optimizeDeps ??= {}).esbuildOptions ??= {};

    config.optimizeDeps.esbuildOptions.define = {
      ...(config.optimizeDeps.esbuildOptions.define || {}),
      "process.env.NODE_ENV": JSON.stringify(mode),
    };

    config.optimizeDeps.include ??= [];
    config.optimizeDeps.include.push(...Object.keys(context.imports));

    config.optimizeDeps.esbuildOptions.plugins ??= [];
    config.optimizeDeps.esbuildOptions.plugins.push(
      reactConditionsResolverEsbuildPlugin(context),
    );
  };

  return {
    name: `rwsdk:react-conditions-resolver:${mode}`,
    enforce: "post",

    configEnvironment(name: string, config: EnvironmentOptions) {
      configureEnvironment(contexts[name], config);
    },

    resolveId(id: string) {
      log(":react-conditions-resolver:resolveId called for id=%s", id);
      const context = contexts[this.environment.name];

      if (context.imports.includes(id)) {
        log(
          ":react-conditions-resolver:resolveId environment=%s: Resolving import: %s",
          context.environment,
          id,
        );

        const resolved = context.resolver(id);

        if (resolved) {
          log(
            ":react-conditions-resolver:resolveId environment=%s: Resolved import: %s -> %s",
            context.environment,
            id,
            resolved,
          );

          return resolved;
        } else {
          log(
            ":react-conditions-resolver:resolveId environment=%s: No result found for import: %s",
            context.environment,
            id,
          );
        }
      }
    },
  };
};
