import { Plugin, EnvironmentOptions } from "vite";
import debug from "debug";

import { ROOT_DIR } from "../lib/constants.mjs";
import { createModuleResolver } from "./moduleResolver.mjs";
import {
  createSSRDepResolver,
  isSSRPath,
  ensureNoSSRNamespace,
  ensureSSRNamespace,
} from "./virtualizedSSRPlugin.mjs";
import { ensureConfigArrays } from "./ensureConfigArrays.mjs";
import { isBareImport } from "./isBareImport.mjs";

const log = debug("rwsdk:vite:react-conditions");

const SSR_IMPORTS = [
  "react",
  "react/jsx-runtime",
  "react/jsx-dev-runtime",
  "react-dom/server.edge",
  "react-dom/server",
  "react-server-dom-webpack/client.edge",
];

const RSC_IMPORTS = [
  "react",
  "react/jsx-runtime",
  "react/jsx-dev-runtime",
  "react-server-dom-webpack/server.edge",
  "react-server-dom-webpack/client.edge",
];

const CLIENT_IMPORTS = [
  "react",
  "react/jsx-runtime",
  "react/jsx-dev-runtime",
  "react-dom/client",
  "react-server-dom-webpack/client.browser",
];

const createRscResolver = ({ projectRootDir }: { projectRootDir: string }) =>
  createModuleResolver({
    name: "rscReact",
    roots: [projectRootDir, ROOT_DIR],
    conditionNames: ["react-server", "workerd", "worker", "edge", "default"],
  });

const createClientResolver = ({ projectRootDir }: { projectRootDir: string }) =>
  createModuleResolver({
    name: "clientReact",
    roots: [projectRootDir, ROOT_DIR],
    conditionNames: ["browser", "default"],
  });

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

  const resolvers = {
    ssr: createSSRDepResolver({ projectRootDir }),
    rsc: createRscResolver({ projectRootDir }),
    client: createClientResolver({ projectRootDir }),
  };

  const reactConditionsResolverEsbuildPlugin = (
    environmentName: "client" | "worker",
  ) => {
    return {
      name: `rwsdk:react-conditions-resolver-esbuild-plugin:${environmentName}`,
      setup(build: any) {
        build.onResolve({ filter: /.*/ }, (args: any) => {
          log(
            ":react-conditions-resolver:esbuild:onResolve called for environment=%s with args=%O",
            args,
          );

          const id = ensureNoSSRNamespace(args.path);

          if (!isBareImport(id)) {
            log(
              ":react-conditions-resolver:esbuild:onResolve environment=%s: Skipping non-bare import: %s",
              environmentName,
              id,
            );
            return;
          }

          if (isSSRPath(args.path)) {
            log(
              ":react-conditions-resolver:esbuild:onResolve environment=%s: Skipping SSR path for virtualizedSSRPlugin to handle: %s",
              environmentName,
              args.path,
            );
            return;
          }

          if (environmentName === "client") {
            if (CLIENT_IMPORTS.includes(id)) {
              log(
                ":react-conditions-resolver:esbuild:onResolve environment=%s: Resolving import: %s",
                environmentName,
                id,
              );

              const resolved = resolvers.client(id);

              if (resolved) {
                log(
                  ":react-conditions-resolver:esbuild:onResolve environment=%s: Resolved import: %s -> %s",
                  environmentName,
                  id,
                  resolved,
                );

                return { path: resolved };
              } else {
                log(
                  ":react-conditions-resolver:esbuild:onResolve environment=%s: No result found for import: %s",
                  environmentName,
                  id,
                );
              }
            } else {
              log(
                ":react-conditions-resolver:esbuild:onResolve environment=%s: Skipping import: %s",
                environmentName,
                id,
              );
            }
          } else if (environmentName === "worker") {
            if (RSC_IMPORTS.includes(id)) {
              log(
                ":react-conditions-resolver:esbuild:onResolve environment=%s: Resolving import: %s",
                environmentName,
                id,
              );

              const resolved = resolvers.rsc(id);

              if (resolved) {
                log(
                  ":react-conditions-resolver:esbuild:onResolve environment=%s: Resolved import: %s -> %s",
                  environmentName,
                  id,
                  resolved,
                );

                return { path: resolved };
              } else {
                log(
                  ":react-conditions-resolver:esbuild:onResolve environment=%s: No result found for import: %s",
                  environmentName,
                  id,
                );
              }
            } else {
              log(
                ":react-conditions-resolver:esbuild:onResolve environment=%s: Skipping import: %s",
                environmentName,
                id,
              );
            }
          }
        });
      },
    };
  };

  const configureClientEnvironment = (config: EnvironmentOptions) => {
    log(
      ":react-conditions-resolver:Applying React conditions resolver for client environment in mode=%s",
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
      reactConditionsResolverEsbuildPlugin("client"),
    );

    removeReactImportsToAllowCustomResolution(config, CLIENT_IMPORTS);

    for (const dep of CLIENT_IMPORTS) {
      const resolved = resolvers.client(dep);

      if (!resolved) {
        log(
          ":react-conditions-resolver:vite:configEnvironment: client: Skipping optimize for dep=%s because it could not be resolved",
          dep,
        );
        continue;
      }

      log(
        ":react-conditions-resolver:vite:configEnvironment: client: Adding optimizeDep for dep=%s and alias to %s",
        dep,
        resolved,
      );

      config.optimizeDeps.include?.push(dep);

      (config.resolve as any).alias.push({
        find: new RegExp(`^${dep.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&")}$`),
        replacement: resolved,
      });
    }
  };

  const configureWorkerEnvironment = (config: EnvironmentOptions) => {
    log(
      ":react-conditions-resolver:Applying React conditions resolver for client environment in mode=%s",
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
      reactConditionsResolverEsbuildPlugin("worker"),
    );

    removeReactImportsToAllowCustomResolution(config, [
      ...RSC_IMPORTS,
      ...SSR_IMPORTS,
    ]);

    for (const dep of RSC_IMPORTS) {
      const resolved = resolvers.client(dep);

      if (!resolved) {
        log(
          ":react-conditions-resolver:vite:configEnvironment: rsc: Skipping optimize for dep=%s because it could not be resolved",
          dep,
        );
        continue;
      }

      log(
        ":react-conditions-resolver:vite:configEnvironment: rsc: Adding optimizeDep for dep=%s and alias to %s",
        dep,
        resolved,
      );

      config.optimizeDeps.include?.push(dep);

      (config.resolve as any).alias.push({
        find: new RegExp(`^${dep.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&")}$`),
        replacement: resolved,
      });
    }

    for (const dep of SSR_IMPORTS) {
      const resolved = resolvers.client(dep);

      if (!resolved) {
        log(
          ":react-conditions-resolver:vite:configEnvironment: ssr: Skipping optimize for dep=%s because it could not be resolved",
          dep,
        );
        continue;
      }

      const id = ensureSSRNamespace(dep);

      log(
        ":react-conditions-resolver:vite:configEnvironment: ssr: Adding optimizeDep for dep=%s and alias to %s",
        id,
        resolved,
      );

      config.optimizeDeps.include?.push(id);

      (config.resolve as any).alias.push({
        find: new RegExp(`^${id.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&")}$`),
        replacement: resolved,
      });
    }
  };

  return [
    {
      name: `rwsdk:react-conditions-resolver:config:${mode}`,
      enforce: "post",

      configEnvironment(name: string, config: EnvironmentOptions) {
        if (name === "client") {
          configureClientEnvironment(config);
        } else if (name === "worker") {
          configureWorkerEnvironment(config);
        }
      },
    },
    {
      name: `rwsdk:react-conditions-resolver:resolveId:${mode}`,
      enforce: "pre",

      resolveId(id: string) {
        const environmentName = this.environment.name;

        log(
          ":react-conditions-resolver:resolveId called for environment=%s id=%s",
          environmentName,
          id,
        );

        if (isSSRPath(id)) {
          log(
            ":react-conditions-resolver:resolveId environment=%s: Skipping SSR path for virtualizedSSRPlugin to handle: %s",
            environmentName,
            id,
          );
          return;
        }

        if (environmentName === "client") {
          if (CLIENT_IMPORTS.includes(id)) {
            log(
              ":react-conditions-resolver:vite:resolveId environment=%s: Resolving import: %s",
              environmentName,
              id,
            );

            const resolved = resolvers.client(id);

            if (resolved) {
              log(
                ":react-conditions-resolver:vite:resolveId environment=%s: Resolved import: %s -> %s",
                environmentName,
                id,
                resolved,
              );

              return resolved;
            } else {
              log(
                ":react-conditions-resolver:vite:resolveId environment=%s: No result found for import: %s",
                environmentName,
                id,
              );
            }
          } else {
            log(
              ":react-conditions-resolver:vite:resolveId environment=%s: Skipping import: %s",
              environmentName,
              id,
            );
          }
        } else if (environmentName === "worker") {
          if (RSC_IMPORTS.includes(id)) {
            log(
              ":react-conditions-resolver:vite:resolveId environment=%s: Resolving import: %s",
              environmentName,
              id,
            );

            const resolved = resolvers.rsc(id);

            if (resolved) {
              log(
                ":react-conditions-resolver:vite:resolveId environment=%s: Resolved import: %s -> %s",
                environmentName,
                id,
                resolved,
              );

              return resolved;
            } else {
              log(
                ":react-conditions-resolver:vite:resolveId environment=%s: No result found for import: %s",
                environmentName,
                id,
              );
            }
          } else {
            log(
              ":react-conditions-resolver:vite:resolveId environment=%s: Skipping import: %s",
              environmentName,
              id,
            );
          }
        }
      },
    },
  ];
};
