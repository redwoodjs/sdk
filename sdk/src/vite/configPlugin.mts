import { Plugin } from "vite";
import { resolve } from "node:path";
import { mergeConfig, InlineConfig } from 'vite';

import {
  DEV_SERVER_PORT,
} from "../lib/constants.mjs";

export const configPlugin = ({
  mode,
  silent,
  projectRootDir,
  clientEntryPathname,
  workerEntryPathname,
  port,
  isUsingPrisma,
}: {
  mode: 'development' | 'production',
  silent: boolean,
  projectRootDir: string,
  clientEntryPathname: string,
  workerEntryPathname: string,
  port: number,
  isUsingPrisma: boolean,
}): Plugin => ({
  name: 'rw-sdk-config',
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
              plugins: [
                {
                  name: 'ignore-virtual-modules',
                  setup(build) {
                    build.onResolve({ filter: /^virtual:use-client-lookup$/ }, () => {
                      return { external: true }; // Mark as external so Esbuild skips it
                    });
                  }
                }
              ]
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
                ...(isUsingPrisma ? [{
                  name: 'prisma-client-wasm',
                  setup(build: any) {
                    build.onResolve({ filter: /.prisma\/client\/default/ }, async (args: any) => {
                      return {
                        path: resolve(projectRootDir, "node_modules/.prisma/client/wasm.js"),
                      }
                    })
                  }
                }] : []),
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
        port: port ?? DEV_SERVER_PORT,
      },
      resolve: {
        conditions: ["workerd"],
        alias: {
          ...(isUsingPrisma ? {
            ".prisma/client/default": resolve(projectRootDir, "node_modules/.prisma/client/wasm.js"),
          } : {}),
        },
      },
    };

    if (command === 'build') {
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
})