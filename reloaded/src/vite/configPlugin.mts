import { Plugin } from "vite";
import { resolve } from "node:path";
import { createRequire } from "node:module";
import { mergeConfig, InlineConfig } from 'vite';

import {
  DEV_SERVER_PORT,
  VENDOR_DIST_DIR,
} from "../lib/constants.mjs";

export const configPlugin = ({ mode,
  silent,
  projectRootDir,
  clientEntryPathname,
  workerEntryPathname,
  port,
}: {
  mode: 'development' | 'production',
  silent: boolean,
  projectRootDir: string,
  clientEntryPathname: string,
  workerEntryPathname: string,
  port: number
}): Plugin => ({
  name: 'rw-reloaded-config',
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
            include: [
              "lodash",
              "lodash/memoize",
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
          ".prisma/client/default": createRequire(
            createRequire(import.meta.url).resolve("@prisma/client"),
          ).resolve(".prisma/client/wasm"),
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