import { type InlineConfig, mergeConfig } from "vite";
import { dirname, resolve } from "node:path";
import {
  CLIENT_DIST_DIR,
  DEV_SERVER_PORT,
  MANIFEST_PATH,
  RELATIVE_CLIENT_PATHNAME,
  RELATIVE_WORKER_PATHNAME,
  ROOT_DIR,
  SRC_DIR,
  VENDOR_DIST_DIR,
  WORKER_DIST_DIR,
} from "../lib/constants.mjs";

import tailwind from "tailwindcss";
import autoprefixer from "autoprefixer";
import reactPlugin from "@vitejs/plugin-react";

import { transformJsxScriptTagsPlugin } from "../lib/vitePlugins/transformJsxScriptTagsPlugin.mjs";
import { useServerPlugin } from "../lib/vitePlugins/useServerPlugin.mjs";
import { useClientPlugin } from "../lib/vitePlugins/useClientPlugin.mjs";
import { useClientLookupPlugin } from "../lib/vitePlugins/useClientLookupPlugin.mjs";
import { transformJsxLinksTagsPlugin } from "../lib/vitePlugins/transformJsxLinksTagsPlugin.mjs";
import { miniflarePlugin } from "../lib/vitePlugins/miniflarePlugin/plugin.mjs";
import { miniflareConfig } from "./miniflare.mjs";
import { asyncSetupPlugin } from "../lib/vitePlugins/asyncSetupPlugin.mjs";
import { restartPlugin } from "../lib/vitePlugins/restartPlugin.mjs";

const MODE =
  process.env.NODE_ENV === "development" ? "development" : "production";

export const viteConfigs = {
  main: (): InlineConfig => ({
    appType: "custom",
    mode: MODE,
    logLevel: "info",
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
      },
      worker: {
        resolve: {
          conditions: ["module", "workerd", "react-server"],
          noExternal: true,
        },
        optimizeDeps: {
          noDiscovery: false,
          include: [
            "react",
            "react/jsx-runtime",
            "react/jsx-dev-runtime",
            "react-dom/server.edge",
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
    resolve: {
      alias: {
        "vendor/react-ssr": resolve(VENDOR_DIST_DIR, "react-ssr.js"),
      },
    },
    server: {
      hmr: true,
      port: DEV_SERVER_PORT,
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
  }),
  dev: ({ setup }: { setup: () => Promise<unknown> }): InlineConfig =>
    mergeConfig(viteConfigs.main(), {
      plugins: [
        asyncSetupPlugin({ setup }),
        restartPlugin({
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
        }),
        miniflarePlugin({
          entry: RELATIVE_WORKER_PATHNAME,
          environment: "worker",
          miniflare: miniflareConfig,
        }),
        // context(justinvdm, 2024-12-03): vite needs the virtual module created by this plugin to be around,
        // even if the code path that use the virtual module are not reached in dev
        useClientLookupPlugin({ filesContainingUseClient: [] }),
      ],
    }),
  deploy: ({
    filesContainingUseClient,
  }: {
    filesContainingUseClient: string[];
  }): InlineConfig =>
    mergeConfig(viteConfigs.main(), {
      plugins: [
        transformJsxScriptTagsPlugin({
          manifestPath: MANIFEST_PATH,
        }),
        useClientLookupPlugin({
          filesContainingUseClient,
        }),
      ],
    }),
};
