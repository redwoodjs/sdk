import { Plugin } from "vite";
import { resolve } from "node:path";
import { createRequire } from "node:module";
import { mergeConfig, InlineConfig } from 'vite';

import tailwind from "tailwindcss";
import autoprefixer from "autoprefixer";
import reactPlugin from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

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
          resolve: {
            external: ["react"],
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
              "react",
              "react/jsx-runtime",
              "react/jsx-dev-runtime",
              "react-dom/server.edge",
              "@prisma/client",
              "@redwoodjs/reloaded/worker",
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
        dedupe: ["react"],
        alias: [
          {
            find: /^react$/,
            replacement: resolve(VENDOR_DIST_DIR, "react.js"),
          },
          {
            find: /^react-dom\/(server|server\.edge)$/,
            replacement: resolve(VENDOR_DIST_DIR, "react-dom-server-edge.js"),
          },
        ],
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
        resolve: {
          alias: {
            ".prisma/client/default": createRequire(
              createRequire(import.meta.url).resolve("@prisma/client"),
            ).resolve(".prisma/client/wasm"),
          },
        },
      });
    }

    return baseConfig;
  },
})