import { dirname, resolve } from "node:path";
import { createRequire } from "node:module";
import { Plugin, mergeConfig, InlineConfig } from 'vite';

import tailwind from "tailwindcss";
import autoprefixer from "autoprefixer";
import reactPlugin from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

import {
  CLIENT_DIST_DIR,
  DEV_SERVER_PORT,
  MANIFEST_PATH,
  RELATIVE_CLIENT_PATHNAME,
  RELATIVE_WORKER_PATHNAME,
  ROOT_DIR,
  WORKER_DIST_DIR,
  VENDOR_DIST_DIR,
} from "../constants.mjs";
import { transformJsxScriptTagsPlugin } from "./transformJsxScriptTagsPlugin.mjs";
import { useServerPlugin } from "./useServerPlugin.mjs";
import { useClientPlugin } from "./useClientPlugin.mjs";
import { useClientLookupPlugin } from "./useClientLookupPlugin.mjs";
import { miniflarePlugin } from "./miniflarePlugin.mjs";
import { asyncSetupPlugin } from "./asyncSetupPlugin.mjs";
import { restartPlugin } from "./restartPlugin.mjs";
import { acceptWasmPlugin } from "./acceptWasmPlugin.mjs";
import { copyPrismaWasmPlugin } from "./copyPrismaWasmPlugin.mjs";
import { codegen } from '../../codegen.mjs';
import { $ } from '../$.mjs';

export function reloadedPlugin(options: {
  mode?: 'main' | 'dev' | 'deploy';
  silent?: boolean;
  port?: number;
  setup?: () => Promise<unknown>;
  restartOnChanges?: boolean;
}): Plugin {
  const MODE = process.env.NODE_ENV === "development" ? "development" : "production";

  return {
    name: 'vite-plugin-reloaded',
    config: () => {
      const baseConfig: InlineConfig = {
        appType: "custom",
        mode: MODE,
        logLevel: options.silent ? "silent" : "info",
        build: {
          minify: MODE !== "development",
          sourcemap: true,
        },
        define: {
          "process.env.PREVIEW": JSON.stringify(Boolean(process.env.PREVIEW ?? false)),
          "process.env.NODE_ENV": JSON.stringify(MODE),
        },
        plugins: [
          tsconfigPaths({ root: ROOT_DIR }),
          miniflarePlugin({
            viteEnvironment: { name: "worker" },
          }),
          reactPlugin(),
          useServerPlugin(),
          useClientPlugin(),
        ],
        environments: {
          client: {
            consumer: "client",
            build: {
              outDir: CLIENT_DIST_DIR,
              manifest: true,
              rollupOptions: {
                input: { client: RELATIVE_CLIENT_PATHNAME },
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
              ],
            },
            build: {
              outDir: WORKER_DIST_DIR,
              emitAssets: true,
              ssr: true,
              rollupOptions: {
                output: {
                  inlineDynamicImports: true,
                },
                input: {
                  worker: RELATIVE_WORKER_PATHNAME,
                },
              },
            },
          },
        },
        server: {
          hmr: true,
          port: options.port ?? DEV_SERVER_PORT,
        },
        css: {
          postcss: {
            plugins: [tailwind, autoprefixer()],
          },
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

      if (options.mode === 'dev') {
        return mergeConfig(baseConfig, {
          plugins: [
            acceptWasmPlugin(),
            asyncSetupPlugin({
              async setup() {
                // context(justinvdm, 2024-12-05): Call indirectly to silence verbose output when VERBOSE is not set
                await $`pnpm build:vendor`;

                // context(justinvdm, 2024-11-28): Types don't affect runtime, so we don't need to block the dev server on them
                void codegen({ silent: false });
              }
            }),
            options.restartOnChanges
              ? restartPlugin({
                filter: (filepath: string) =>
                  !filepath.endsWith(".d.ts") &&
                  (filepath.endsWith(".ts") ||
                    filepath.endsWith(".tsx") ||
                    filepath.endsWith(".mts") ||
                    filepath.endsWith(".js") ||
                    filepath.endsWith(".mjs") ||
                    filepath.endsWith(".jsx") ||
                    filepath.endsWith(".json")) &&
                  (filepath.startsWith(resolve(ROOT_DIR, "scripts")) ||
                    dirname(filepath) === ROOT_DIR),
              })
              : null,
            useClientLookupPlugin({
              rootDir: ROOT_DIR,
              containingPath: "./src/app",
            }),
          ],
        });
      }

      if (options.mode === 'deploy') {
        return mergeConfig(baseConfig, {
          plugins: [
            transformJsxScriptTagsPlugin({
              manifestPath: MANIFEST_PATH,
            }),
            useClientLookupPlugin({
              rootDir: ROOT_DIR,
              containingPath: "./src/app",
            }),
            copyPrismaWasmPlugin(),
          ],
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
  };
}
