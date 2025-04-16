import { resolve } from "path";
import { mkdirp, copy } from "fs-extra";
import { Plugin, PluginOption } from "vite";
import { VENDOR_DIST_DIR } from "../lib/constants.mjs";
import reactPlugin from "@vitejs/plugin-react";

const copyReactFiles = async (viteDistDir: string) => {
  await mkdirp(viteDistDir);

  const vendorBundles = [
    ["react.worker", "worker"],
    ["react.client", "client"],
    ["react-dom-server-edge", null],
    ["jsx-runtime.worker", "worker"],
    ["jsx-runtime.client", "client"],
    ["jsx-dev-runtime.worker", "worker"],
    ["jsx-dev-runtime.client", "client"],
  ] as const;

  for (const mode of ["development", "production"] as const) {
    for (const [bundle, env] of vendorBundles) {
      const fileName = `${bundle}.${mode}.js`;
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
};

const createJsxRuntimeEsbuildPlugin = (
  viteDistDir: string,
  mode: "development" | "production"
) => ({
  name: "rwsdk:rewrite-jsx-runtime-imports",
  setup(build: any) {
    build.onResolve({ filter: /^react\/jsx-runtime$/ }, () => ({
      path: resolve(viteDistDir, `jsx-runtime.${mode}.js`),
    }));
    build.onResolve({ filter: /^react\/jsx-dev-runtime$/ }, () => ({
      path: resolve(viteDistDir, `jsx-dev-runtime.${mode}.js`),
    }));
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
    if (name === "react") {
      return resolve(viteDistDir, `react.${env}.${mode}.js`);
    }
    if (name.startsWith("jsx")) {
      return resolve(viteDistDir, `${name}.${env}.${mode}.js`);
    }
    return resolve(viteDistDir, `${name}.${mode}.js`);
  };

  await copyReactFiles(viteDistDir);

  const commonPlugin: Plugin = {
    name: "rwsdk:jsx-runtime",
    enforce: "pre",
    resolveId(id) {
      if (id === "react/jsx-runtime") {
        const env = this.environment.name as "worker" | "client";
        return resolveVendorBundle("jsx-runtime", env);
      }
      if (id === "react/jsx-dev-runtime") {
        const env = this.environment.name as "worker" | "client";
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
                  ...createJsxRuntimeEsbuildPlugin(viteDistDir, mode),
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
                  ...createJsxRuntimeEsbuildPlugin(viteDistDir, mode),
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
      return environment.name === "worker";
    },
    async configureServer() {
      await copyReactFiles(viteDistDir);
    },
    resolveId(id) {
      if (id === "react") {
        return resolveVendorBundle("react", "worker");
      }
      if (id === "react-dom/server.edge" || id === "react-dom/server") {
        return resolveVendorBundle("react-dom-server-edge", "worker");
      }
    },
    config: () => ({
      environments: {
        worker: {
          optimizeDeps: {
            esbuildOptions: {
              plugins: [
                {
                  name: "rwsdk:rewrite-react-imports",
                  setup(build) {
                    build.onResolve({ filter: /^react$/ }, () => ({
                      path: resolveVendorBundle("react", "worker"),
                    }));
                    build.onResolve(
                      { filter: /^react-dom\/server\.edge$/ },
                      () => ({
                        path: resolveVendorBundle(
                          "react-dom-server-edge",
                          "worker"
                        ),
                      })
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
      return environment.name === "client";
    },
    resolveId(id) {
      if (id === "react") {
        return resolveVendorBundle("react", "client");
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
                    build.onResolve({ filter: /^react$/ }, () => ({
                      path: resolveVendorBundle("react", "client"),
                    }));
                  },
                },
              ],
            },
          },
        },
      },
    }),
  };

  return [
    ...wrapReactPluginConfig(reactPlugin()),
    commonPlugin,
    workerReactPlugin,
    clientReactPlugin,
  ];
};
