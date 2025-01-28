import { type InlineConfig, mergeConfig } from "vite";
import { dirname, resolve } from "node:path";
import {
  CLIENT_DIST_DIR,
  DEV_SERVER_PORT,
  MANIFEST_PATH,
  RELATIVE_CLIENT_PATHNAME,
  RELATIVE_WORKER_PATHNAME,
  ROOT_DIR,
  WORKER_DIST_DIR,
  VENDOR_DIST_DIR,
} from "../lib/constants.mjs";

import tailwind from "tailwindcss";
import autoprefixer from "autoprefixer";
import reactPlugin from "@vitejs/plugin-react";

import { transformJsxScriptTagsPlugin } from "../lib/vitePlugins/transformJsxScriptTagsPlugin.mjs";
import { useServerPlugin } from "../lib/vitePlugins/useServerPlugin.mjs";
import { useClientPlugin } from "../lib/vitePlugins/useClientPlugin.mjs";
import { useClientLookupPlugin } from "../lib/vitePlugins/useClientLookupPlugin.mjs";
import { miniflarePlugin } from "../lib/vitePlugins/miniflarePlugin.mjs";
import { miniflareConfig } from "./miniflare.mjs";
import { asyncSetupPlugin } from "../lib/vitePlugins/asyncSetupPlugin.mjs";
import { restartPlugin } from "../lib/vitePlugins/restartPlugin.mjs";

const MODE =
  process.env.NODE_ENV === "development" ? "development" : "production";

export const viteConfigs = {
  main: ({ silent = false, port }: { silent?: boolean, port?: number } = {}): InlineConfig => ({
    appType: "custom",
    mode: MODE,
    logLevel: silent ? "silent" : "info",
    build: {
      minify: MODE !== "development",
      sourcemap: true,
    },
    define: {
      "process.env.PREVIEW": JSON.stringify(
        Boolean(process.env.PREVIEW ?? false),
      ),
      "process.env.NODE_ENV": JSON.stringify(MODE),
    },
    plugins: [reactPlugin(), useServerPlugin(), useClientPlugin()],
    environments: {
      client: {
        consumer: "client",
        build: {
          outDir: CLIENT_DIST_DIR,
          manifest: true,
          rollupOptions: {
            input: {
              client: RELATIVE_CLIENT_PATHNAME,
            },
          },
        },
        resolve: {
          external: ['react']
        }
      },
      worker: {
        resolve: {
          conditions: ["workerd", "react-server"],
          // context(justinvdm, 2025-01-06): We rely on vite's prebundling and then let vite provide us with this prebundled code:
          // - we shouldn't needing to evaluate each and every module of each and every dependency in the module runner (prebundle avoids this)
          // - we can't rely on dynamic imports from within the miniflare sandbox (without teaching it about each and every module of each and every dependency)
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
      port: port ?? DEV_SERVER_PORT,
    },
    builder: {
      async buildApp(builder) {
        await builder.build(builder.environments["client"]);
        await builder.build(builder.environments["worker"]);
      },
    },
    css: {
      postcss: {
        plugins: [tailwind, autoprefixer()],
      },
    },
    resolve: {
      dedupe: ['react'],
      alias: [{
        find: /^react$/,
        replacement: resolve(VENDOR_DIST_DIR, 'react.js'),
      }, {
        find: 'react-dom/server.edge',
        replacement: resolve(VENDOR_DIST_DIR, 'react-dom-server-edge.js'),
      }]
    }
  }),
  dev: ({ setup, restartOnChanges = true, ...opts }: { setup: () => Promise<unknown>, silent?: boolean, port?: number, restartOnChanges?: boolean }): InlineConfig =>
    mergeConfig(viteConfigs.main(opts), {
      plugins: [
        asyncSetupPlugin({ setup }),
        restartOnChanges ? restartPlugin({
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
        }) : null,
        miniflarePlugin({
          viteEnvironment: {
            name: 'worker',
          }
        }),
        // context(justinvdm, 2024-12-03): vite needs the virtual module created by this plugin to be around,
        // even if the code path that use the virtual module are not reached in dev
        useClientLookupPlugin({ rootDir: ROOT_DIR, containingPath: './src/app' }),
      ],
    }),
  deploy: (): InlineConfig =>
    mergeConfig(viteConfigs.main(), {
      plugins: [
        transformJsxScriptTagsPlugin({
          manifestPath: MANIFEST_PATH,
        }),
        useClientLookupPlugin({
          rootDir: ROOT_DIR,
          containingPath: './src/app',
        }),
      ],
      environments: {
        worker: {
          resolve: {
            external: ['@prisma/client']
          },
          build: {
            rollupOptions: {
              external: ['cloudflare:workers']
            }
          }
        }
      }
    }),
};
