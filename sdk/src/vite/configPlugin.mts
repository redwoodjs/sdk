import { Plugin } from "vite";
import { resolve } from "node:path";
import { mergeConfig, InlineConfig } from "vite";

const ignoreVirtualModules = {
  name: "rwsdk:ignore-virtual-modules",
  setup(build: any) {
    build.onResolve({ filter: /^virtual:use-client-lookup$/ }, () => {
      return { external: true };
    });
  },
};

export const configPlugin = ({
  mode,
  silent,
  projectRootDir,
  clientEntryPathname,
  workerEntryPathname,
  isUsingPrisma,
}: {
  mode: "development" | "production";
  silent: boolean;
  projectRootDir: string;
  clientEntryPathname: string;
  workerEntryPathname: string;
  isUsingPrisma: boolean;
}): Plugin => ({
  name: "rwsdk:config",
  config: (_, { command }) => {
    const baseConfig: InlineConfig = {
      appType: "custom",
      mode,
      logLevel: silent ? "silent" : "info",
      build: {
        minify: mode !== "development",
        sourcemap: true,
      },
      define: {
        "process.env.NODE_ENV": JSON.stringify(mode),
      },
      environments: {
        client: {
          consumer: "client",
          build: {
            outDir: resolve(projectRootDir, "dist", "client"),
            manifest: true,
            rollupOptions: {
              input: { client: clientEntryPathname },
            },
          },
          optimizeDeps: {
            noDiscovery: false,
            esbuildOptions: {
              plugins: [ignoreVirtualModules],
            },
            include: [
              "react",
              "react-dom/client",
              "react/jsx-runtime",
              "react/jsx-dev-runtime",
              "react-server-dom-webpack/client.browser",
            ],
          },
        },
        worker: {
          resolve: {
            conditions: ["workerd", "react-server"],
            noExternal: true,
          },
          optimizeDeps: {
            noDiscovery: false,
            esbuildOptions: {
              conditions: ["workerd", "react-server"],
              plugins: [
                ...(isUsingPrisma
                  ? [
                      {
                        name: "rwsdk:prisma-client-wasm",
                        setup(build: any) {
                          build.onResolve(
                            { filter: /.prisma\/client\/default/ },
                            async (args: any) => {
                              return {
                                path: resolve(
                                  projectRootDir,
                                  "node_modules/.prisma/client/wasm.js",
                                ),
                              };
                            },
                          );
                        },
                      },
                    ]
                  : []),
                ignoreVirtualModules,
              ],
            },
            include: [
              "react/jsx-runtime",
              "react/jsx-dev-runtime",
              "react-server-dom-webpack/client.edge",
              "react-server-dom-webpack/server.edge",
            ],
          },
          build: {
            outDir: resolve(projectRootDir, "dist", "worker"),
            emitAssets: true,
            ssr: true,
            rollupOptions: {
              output: {
                inlineDynamicImports: true,
              },
              input: {
                worker: workerEntryPathname,
              },
            },
          },
        },
      },
      server: {
        hmr: true,
      },
      resolve: {
        conditions: ["workerd"],
        alias: {
          ...(isUsingPrisma
            ? {
                ".prisma/client/default": resolve(
                  projectRootDir,
                  "node_modules/.prisma/client/wasm.js",
                ),
              }
            : {}),
        },
      },
    };

    if (command === "build") {
      return mergeConfig(baseConfig, {
        environments: {
          worker: {
            build: {
              rollupOptions: {
                external: ["cloudflare:workers", "node:stream", /\.wasm$/],
              },
            },
          },
        },
      });
    }

    return baseConfig;
  },
});
