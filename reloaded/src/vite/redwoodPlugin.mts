import { dirname, resolve } from "node:path";
import { createRequire } from "node:module";
import { Plugin, mergeConfig, InlineConfig } from 'vite';

import tailwind from "tailwindcss";
import autoprefixer from "autoprefixer";
import reactPlugin from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

import {
  DEV_SERVER_PORT,
  VENDOR_DIST_DIR,
} from "../lib/constants.mjs";
import { transformJsxScriptTagsPlugin } from "./transformJsxScriptTagsPlugin.mjs";
import { useServerPlugin } from "./useServerPlugin.mjs";
import { useClientPlugin } from "./useClientPlugin.mjs";
import { useClientLookupPlugin } from "./useClientLookupPlugin.mjs";
import { miniflarePlugin } from "./miniflarePlugin.mjs";
import { asyncSetupPlugin } from "./asyncSetupPlugin.mjs";
import { restartPlugin } from "./restartPlugin.mjs";
import { acceptWasmPlugin } from "./acceptWasmPlugin.mjs";
import { copyPrismaWasmPlugin } from "./copyPrismaWasmPlugin.mjs";
import { codegen } from '../scripts/codegen.mjs';

export function redwoodPlugin(options: {
  silent?: boolean;
  port?: number;
  restartOnChanges?: boolean;
  rootDir?: string;
  entry?: {
    client?: string;
    worker?: string;
  };
} = {}): Plugin {
  const projectRootDir = process.cwd();
  const MODE = process.env.NODE_ENV === "development" ? "development" : "production";
  const clientEntryPathname = resolve(projectRootDir, options?.entry?.client ?? 'src/client.tsx');
  const workerEntryPathname = resolve(projectRootDir, options?.entry?.worker ?? 'src/worker.tsx');

  return {
    name: 'vite-plugin-reloaded',
    config: (_, { command }) => {
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
          tsconfigPaths({ root: projectRootDir }),
          miniflarePlugin({
            rootDir: projectRootDir,
            viteEnvironment: { name: "worker" },
            configPath: resolve(projectRootDir, "wrangler.toml"),
          }),
          reactPlugin(),
          useServerPlugin(),
          useClientPlugin(),
        ],
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

      if (command === 'serve') {
        return mergeConfig(baseConfig, {
          plugins: [
            acceptWasmPlugin(),
            asyncSetupPlugin({
              async setup() {
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
                  dirname(filepath) === projectRootDir,
              })
              : null,
            useClientLookupPlugin({
              rootDir: projectRootDir,
              containingPath: "./src/app",
            }),
          ],
        });
      }

      if (command === 'build') {
        return mergeConfig(baseConfig, {
          plugins: [
            transformJsxScriptTagsPlugin({
              manifestPath: resolve(projectRootDir, "dist", "client", ".vite", "manifest.json"),
            }),
            useClientLookupPlugin({
              rootDir: projectRootDir,
              containingPath: "./src/app",
            }),
            copyPrismaWasmPlugin({ rootDir: projectRootDir }),
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
