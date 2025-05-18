import { resolve } from "path";
import { Plugin, EnvironmentOptions } from "vite";
import { ROOT_DIR } from "../lib/constants.mjs";
import debug from "debug";
import { pathExists } from "fs-extra";
import enhancedResolve from "enhanced-resolve";
import { createRequire } from "node:module";
import {
  createModuleResolver,
  type ModuleResolver,
} from "./moduleResolver.mjs";

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

const ENV_CONFIG = {
  worker: {
    conditionNames: ["react-server", "workerd", "worker", "edge", "default"],
    imports: WORKER_PACKAGES,
  },
  client: {
    conditionNames: ["browser", "default"],
    imports: CLIENT_PACKAGES,
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

  const sdkRequire = createRequire(ROOT_DIR);

  const workerResolver = createModuleResolver({
    conditionNames: ["react-server", "workerd", "worker", "edge", "default"],
    roots: [projectRootDir, ROOT_DIR],
  });

  const clientResolver = createModuleResolver({
    conditionNames: ["browser", "default"],
    roots: [projectRootDir, ROOT_DIR],
  });

  const reactConditionsResolverEsbuildPlugin = ({
    environment,
    config,
    imports,
    resolver,
  }: {
    environment: "worker" | "client";
    config: EnvironmentOptions;
    imports: string[];
    resolver: ModuleResolver;
  }) => {
    return {
      name: `react-conditions-resolver-esbuild-plugin:${environment}`,
      setup(build: any) {
        build.onResolve({ filter: /.*/ }, (args: any) => {
          log(
            ":react-conditions-resolver:onResolve called for environment=%s with args=%O",
            args,
          );

          const found = imports.find((importPath) => {
            return args.path === importPath;
          });

          if (found) {
            log(
              ":react-conditions-resolver:onResolve environment=%s: Found matching import: %s",
              environment,
              found,
            );

            const path = resolver(args.path);

            if (path) {
              log(
                ":react-conditions-resolver:onResolve environment=%s: Resolved matching import: %s -> %s",
                environment,
                args.path,
                path,
              );
              return { path };
            } else {
              log(
                ":react-conditions-resolver:onResolve environment=%s: No result found for import: %s",
                environment,
                args.path,
              );
            }
          } else {
            log(
              ":react-conditions-resolver:onResolve environment=%s: No matching import found for path: %s",
              environment,
              args.path,
            );
          }
        });
      },
    };
  };

  const configureEnvironment = ({
    environment,
    config,
    imports,
    resolver,
  }: {
    environment: "worker" | "client";
    config: EnvironmentOptions;
    imports: string[];
    resolver: ModuleResolver;
  }) => {
    log(
      ":react-conditions-resolver:Applying React conditions resolver for name=%s environment in mode=%s",
      environment,
      mode,
    );

    (config.optimizeDeps ??= {}).esbuildOptions ??= {};

    config.optimizeDeps.esbuildOptions.define = {
      ...(config.optimizeDeps.esbuildOptions.define || {}),
      "process.env.NODE_ENV": JSON.stringify(mode),
    };

    config.optimizeDeps.include ??= [];
    config.optimizeDeps.include.push(...Object.keys(imports));

    config.optimizeDeps.esbuildOptions.plugins ??= [];
    config.optimizeDeps.esbuildOptions.plugins.push(
      reactConditionsResolverEsbuildPlugin({
        environment,
        config,
        imports,
        resolver,
      }),
    );
  };

  return {
    name: `rwsdk:react-conditions-resolver:${mode}`,
    enforce: "post",

    configEnvironment(name: string, config: EnvironmentOptions) {
      if (name === "worker") {
        configureEnvironment({
          environment: "worker",
          config,
          imports: WORKER_PACKAGES,
          resolver: workerResolver,
        });
      }

      if (name === "client") {
        configureEnvironment({
          environment: "client",
          config,
          imports: CLIENT_PACKAGES,
          resolver: clientResolver,
        });
      }
    },

    resolveId(id: string) {
      log(":react-conditions-resolver:resolveId called for id=%s", id);
    },
  };
};
