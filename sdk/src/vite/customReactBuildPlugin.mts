import { resolve } from "path";
import { mkdirp, copy } from "fs-extra";
import { Plugin, PluginOption } from "vite";
import { VENDOR_DIST_DIR } from "../lib/constants.mjs";
import reactPlugin from "@vitejs/plugin-react";
import createDebugger from "debug";

const debug = createDebugger("rwsdk:vite:react");

const copyReactFiles = async (viteDistDir: string) => {
  await mkdirp(viteDistDir);

  const vendorBundles = [
    "react",
    "react-dom",
    "jsx-runtime",
    "jsx-dev-runtime",
  ] as const;

  for (const mode of ["development", "production"] as const) {
    for (const env of ["worker", "client"] as const) {
      for (const bundle of vendorBundles) {
        const fileName = `${bundle}.${env}.${mode}.js`;
        await copy(
          resolve(VENDOR_DIST_DIR, fileName),
          resolve(viteDistDir, fileName)
        );
        await copy(
          resolve(VENDOR_DIST_DIR, `${fileName}.map`),
          resolve(viteDistDir, `${fileName}.map`)
        );
      }
    }
  }
};

const createJsxRuntimeEsbuildPlugin = (
  viteDistDir: string,
  mode: "development" | "production",
  environment: "worker" | "client"
) => ({
  name: "rwsdk:rewrite-jsx-runtime-imports",
  setup(build: any) {
    debug("setting up jsx runtime esbuild plugin for %s env", environment);
    build.onResolve({ filter: /^react\/jsx-runtime$/ }, (args: any) => {
      debug("jsx runtime esbuild resolving jsx-runtime: %o", args);
      return {
        path: resolve(viteDistDir, `jsx-runtime.${environment}.${mode}.js`),
      };
    });
    build.onResolve({ filter: /^react\/jsx-dev-runtime$/ }, (args: any) => {
      debug("jsx runtime esbuild resolving jsx-dev-runtime: %o", args);
      return {
        path: resolve(viteDistDir, `jsx-dev-runtime.${environment}.${mode}.js`),
      };
    });
    build.onResolve({ filter: /^react$/ }, (args: any) => {
      debug("jsx runtime esbuild resolving react: %o", args);
      return { path: resolve(viteDistDir, `react.${environment}.${mode}.js`) };
    });
  },
});

// context(justinvdm, 2024-03-19): Wraps Vite's React plugin to remove its
// optimizeDeps.include configuration. This is necessary because the React plugin
// automatically adds React dependencies to optimizeDeps.include, but we need full
// control over React resolution to use our environment-specific builds (worker vs
// client) and custom JSX runtime bundles.
const wrapReactPluginConfig = (plugins: PluginOption[]): Plugin[] =>
  plugins.map((p) => {
    // Skip non-object plugins
    if (!p || typeof p !== "object" || Array.isArray(p)) {
      return p;
    }

    const plugin = p as Plugin;
    const originalConfig = plugin.config;

    return {
      ...plugin,
      config: (config, env) => {
        if (typeof originalConfig === "function") {
          const result = originalConfig.call(plugin as any, config, env);
          if (
            result &&
            typeof result === "object" &&
            "optimizeDeps" in result
          ) {
            const { optimizeDeps, ...rest } = result;
            if (
              optimizeDeps &&
              typeof optimizeDeps === "object" &&
              "include" in optimizeDeps
            ) {
              const { include, ...otherOptimizeDeps } = optimizeDeps;
              return {
                ...rest,
                optimizeDeps: otherOptimizeDeps,
              };
            }
          }
          return result;
        }
        return null;
      },
    };
  }) as Plugin[];

export const customReactBuildPlugin = async ({
  projectRootDir,
  mode,
}: {
  projectRootDir: string;
  mode: "development" | "production";
}): Promise<Plugin[]> => {
  const viteDistDir = resolve(
    projectRootDir,
    "node_modules",
    ".vite_redwoodjs_sdk"
  );

  const resolveVendorBundle = (name: string, env: "worker" | "client") => {
    const resolved = (() => {
      switch (name) {
        case "react":
          return resolve(viteDistDir, `react.${env}.${mode}.js`);
        case "react-dom.server":
          return resolve(viteDistDir, `react-dom.server.${mode}.js`);
        case "jsx-runtime":
        case "jsx-dev-runtime":
          return resolve(viteDistDir, `${name}.${env}.${mode}.js`);
        default:
          return resolve(viteDistDir, `${name}.${env}.${mode}.js`);
      }
    })();
    debug("resolved %s for env %s to %s", name, env, resolved);
    return resolved;
  };

  debug("initializing with mode %s", mode);
  await copyReactFiles(viteDistDir);

  const commonPlugin: Plugin = {
    name: "rwsdk:jsx-runtime",
    enforce: "pre",
    resolveId(id) {
      if (id === "react/jsx-runtime") {
        const env = this.environment.name as "worker" | "client";
        debug("resolving jsx-runtime for env %s", env);
        return resolveVendorBundle("jsx-runtime", env);
      }
      if (id === "react/jsx-dev-runtime") {
        const env = this.environment.name as "worker" | "client";
        debug("resolving jsx-dev-runtime for env %s", env);
        return resolveVendorBundle("jsx-dev-runtime", env);
      }
    },
    config: () => ({
      environments: {
        worker: {
          optimizeDeps: {
            esbuildOptions: {
              plugins: [
                {
                  ...createJsxRuntimeEsbuildPlugin(viteDistDir, mode, "worker"),
                  name: "rwsdk:worker:rewrite-jsx-runtime-imports",
                },
              ],
            },
          },
        },
        client: {
          optimizeDeps: {
            esbuildOptions: {
              plugins: [
                {
                  ...createJsxRuntimeEsbuildPlugin(viteDistDir, mode, "client"),
                  name: "rwsdk:client:rewrite-jsx-runtime-imports",
                },
              ],
            },
          },
        },
      },
    }),
  };

  const workerReactPlugin: Plugin = {
    name: "rwsdk:custom-react-build",
    enforce: "pre",
    applyToEnvironment: (environment) => {
      debug("checking if plugin applies to env %s", environment.name);
      return environment.name === "worker";
    },
    resolveId(id) {
      debug("worker plugin resolving id %s", id);
      if (id === "react") {
        return resolveVendorBundle("react", "worker");
      }
      // Base react-dom gets the worker variant (with react-server condition)
      if (id === "react-dom") {
        debug("resolving base react-dom to worker variant");
        return resolveVendorBundle("react-dom", "worker");
      }
      // Server entrypoints get the server variant (without react-server condition)
      if (id === "react-dom/server.edge" || id === "react-dom/server") {
        debug("resolving react-dom server entrypoints to server variant");
        return resolveVendorBundle("react-dom.server", "worker");
      }
    },
    config: () => ({
      environments: {
        worker: {
          optimizeDeps: {
            esbuildOptions: {
              plugins: [
                {
                  name: "rwsdk:worker:rewrite-react-imports",
                  setup(build) {
                    build.onResolve({ filter: /^react$/ }, (args) => {
                      debug("worker esbuild resolving react: %o", args);
                      return { path: resolveVendorBundle("react", "worker") };
                    });
                    build.onResolve({ filter: /^react-dom$/ }, (args) => {
                      debug(
                        "worker esbuild resolving base react-dom: %o",
                        args
                      );
                      return {
                        path: resolveVendorBundle("react-dom", "worker"),
                      };
                    });
                    build.onResolve(
                      { filter: /^react-dom\/(server\.edge|server)$/ },
                      (args) => {
                        debug(
                          "worker esbuild resolving react-dom server: %o",
                          args
                        );
                        return {
                          path: resolveVendorBundle(
                            "react-dom.server",
                            "worker"
                          ),
                        };
                      }
                    );
                  },
                },
              ],
            },
          },
        },
      },
    }),
  };

  const clientReactPlugin: Plugin = {
    name: "rwsdk:client-react",
    enforce: "pre",
    applyToEnvironment: (environment) => {
      debug("checking if plugin applies to env %s", environment.name);
      return environment.name === "client";
    },
    resolveId(id) {
      debug("client plugin resolving id %s", id);
      if (id === "react") {
        return resolveVendorBundle("react", "client");
      }
      if (id === "react-dom/client") {
        debug("resolving react-dom client");
        return resolveVendorBundle("react-dom", "client");
      }
    },
    config: () => ({
      environments: {
        client: {
          optimizeDeps: {
            esbuildOptions: {
              plugins: [
                {
                  name: "rwsdk:client:rewrite-react-imports",
                  setup(build) {
                    build.onResolve({ filter: /^react$/ }, (args) => {
                      debug("client esbuild resolving react: %o", args);
                      return { path: resolveVendorBundle("react", "client") };
                    });
                    build.onResolve(
                      { filter: /^react-dom\/client$/ },
                      (args) => {
                        debug(
                          "client esbuild resolving react-dom client: %o",
                          args
                        );
                        return {
                          path: resolveVendorBundle("react-dom", "client"),
                        };
                      }
                    );
                  },
                },
              ],
            },
          },
        },
      },
    }),
  };

  debug("returning plugins");
  return [
    ...wrapReactPluginConfig(reactPlugin()),
    commonPlugin,
    workerReactPlugin,
    clientReactPlugin,
  ];
};
