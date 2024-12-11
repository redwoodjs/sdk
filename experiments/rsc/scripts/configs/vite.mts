import {
  type InlineConfig,
  type Plugin,
  type ViteDevServer,
  mergeConfig,
} from "vite";
import { resolve } from "node:path";
import {
  CLIENT_DIST_DIR,
  DEV_SERVER_PORT,
  MANIFEST_PATH,
  RELATIVE_CLIENT_PATHNAME,
  RELATIVE_WORKER_PATHNAME,
  SRC_DIR,
  VENDOR_DIST_DIR,
  WORKER_DIST_DIR,
} from "../lib/constants.mjs";

import tailwind from "tailwindcss";
import autoprefixer from "autoprefixer";

import { transformJsxScriptTagsPlugin } from "../lib/vitePlugins/transformJsxScriptTagsPlugin.mjs";
import { useServerPlugin } from "../lib/vitePlugins/useServerPlugin.mjs";
import { useClientPlugin } from "../lib/vitePlugins/useClientPlugin.mjs";
import commonjsPlugin from "vite-plugin-commonjs";
import { useClientLookupPlugin } from "../lib/vitePlugins/useClientLookupPlugin.mjs";
import { transformJsxLinksTagsPlugin } from "../lib/vitePlugins/transformJsxLinksTagsPlugin.mjs";
import { miniflarePlugin } from "../lib/vitePlugins/miniflarePlugin/plugin.mjs";
import { miniflareConfig } from "./miniflare.mjs";

const MODE =
  process.env.NODE_ENV === "development" ? "development" : "production";

export const viteConfigs = {
  main: (): InlineConfig => ({
    mode: MODE,
    logLevel: process.env.VERBOSE ? "info" : "warn",
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
    plugins: [
      commonjsPlugin({
        filter: (id) => {
          return id.includes("react-server-dom-webpack-server.edge");
        },
      }),
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
            input: {
              client: RELATIVE_CLIENT_PATHNAME,
              style: resolve(SRC_DIR, "app", "style.css"),
            },
          },
        },
      },
      worker: {
        resolve: {
          conditions: ["module", "workerd", "react-server"],
          noExternal: true,
        },
        build: {
          outDir: WORKER_DIST_DIR,
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
      middlewareMode: true,
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
        plugins: [tailwind, autoprefixer],
      },
    },
  }),
  dev: (): InlineConfig =>
    mergeConfig(viteConfigs.main(), {
      plugins: [
        miniflarePlugin({
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
        transformJsxLinksTagsPlugin({
          manifestPath: MANIFEST_PATH,
        }),
        useClientLookupPlugin({
          filesContainingUseClient,
        }),
      ],
    }),
};
