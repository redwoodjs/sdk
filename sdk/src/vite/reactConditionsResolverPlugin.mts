import { Plugin, EnvironmentOptions } from "vite";
import debug from "debug";

import { ROOT_DIR } from "../lib/constants.mjs";
import { createModuleResolver } from "./moduleResolver.mjs";
import { isSSRPath } from "./virtualizedSSRPlugin.mjs";
import { ensureConfigArrays } from "./ensureConfigArrays.mjs";

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
      "react-server-dom-webpack/client.edge",
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
      "react-server-dom-webpack/client.browser",
    ],
  },
};

// context(justinvdm, 18 May 2025): We remove the relevant React import paths
// from Vite's optimizeDeps.include and resolve.alias arrays to prevent Vite's
// up-front dependency optimization and aliasing from blocking our plugin from
// intercepting and resolving these imports. If these imports remain in
// optimizeDeps.include or resolve.alias, Vite will short-circuit and always use
// its default resolution, which prevents us having different React builds for
// SSR (Server-Side Rendering) and RSC (React Server Components) in the same
// Cloudflare runtime environment. By removing these imports from the up-front
// optimizations, we ensure our plugin's esbuild plugin (for optimizeDeps in
// development) and resolveId hook (for builds) can handle these React imports
// as needed.
const removeReactImportsToAllowCustomResolution = (
  config: any,
  imports: string[],
) => {
  ensureConfigArrays(config);
  config.optimizeDeps.include = config.optimizeDeps.include.filter(
    (dep: string) => !imports.includes(dep),
  );
  (config.resolve.alias as any) = (config.resolve.alias as any).filter(
    (alias: { find: RegExp | string }) => {
      if (alias.find instanceof RegExp) {
        return !imports.some((imp) =>
          alias.find instanceof RegExp ? alias.find.test(imp) : false,
        );
      } else {
        return !imports.includes(alias.find);
      }
    },
  );
};

export const reactConditionsResolverPlugin = async ({
  mode = "development",
  command = "serve",
  projectRootDir,
}: {
  projectRootDir: string;
  mode?: "development" | "production";
  command?: "build" | "serve";
}): Promise<Plugin[]> => {
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
            name: `react-conditions-resolver:${environment}`,
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

          if (isSSRPath(args.path)) {
            log(
              ":react-conditions-resolver:onResolve environment=%s: Skipping SSR path: %s",
              context.environment,
              args.path,
            );
            return;
          }

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

    ensureConfigArrays(config);

    (config.optimizeDeps ??= {}).esbuildOptions ??= {};

    config.optimizeDeps.esbuildOptions.define = {
      ...(config.optimizeDeps.esbuildOptions.define || {}),
      "process.env.NODE_ENV": JSON.stringify(mode),
    };

    config.optimizeDeps.esbuildOptions.plugins ??= [];
    config.optimizeDeps.esbuildOptions.plugins.push(
      reactConditionsResolverEsbuildPlugin(context),
    );

    removeReactImportsToAllowCustomResolution(config, context.imports);
  };

  return [
    {
      name: `rwsdk:react-conditions-resolver:config:${mode}`,
      enforce: "post",

      configEnvironment(name: string, config: EnvironmentOptions) {
        const context = contexts[name];
        if (context) {
          configureEnvironment(context, config);
        }
      },

      config(config: EnvironmentOptions) {
        for (const context of Object.values(contexts)) {
          removeReactImportsToAllowCustomResolution(config, context.imports);
        }
      },
    },
    {
      name: `rwsdk:react-conditions-resolver:resolveId:${mode}`,
      enforce: "pre",

      resolveId(id: string) {
        const context = contexts[this.environment.name];

        if (!context) {
          return;
        }

        log(
          ":react-conditions-resolver:resolveId called for environment=%s id=%s",
          this.environment.name,
          id,
        );

        if (isSSRPath(id)) {
          log(
            ":react-conditions-resolver:resolveId environment=%s: Skipping SSR path: %s",
            this.environment.name,
            id,
          );
          return;
        }

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
    },
  ];
};
