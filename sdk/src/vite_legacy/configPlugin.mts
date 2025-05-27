import { Plugin } from "vite";
import { resolve } from "node:path";
import { mergeConfig, InlineConfig } from "vite";
import { PrismaCheckResult } from "./checkIsUsingPrisma.mjs";

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
}: {
  mode: "development" | "production";
  silent: boolean;
  projectRootDir: string;
  clientEntryPathname: string;
  workerEntryPathname: string;
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
              input: {
                client: clientEntryPathname,
              },
            },
          },
          optimizeDeps: {
            noDiscovery: false,
            esbuildOptions: {
              plugins: [ignoreVirtualModules],
            },
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
              plugins: [ignoreVirtualModules],
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
        alias: [],
      },
    };

    if (command === "build") {
      return mergeConfig(baseConfig, {
        environments: {
          worker: {
            build: {
              rollupOptions: {
                external: ["cloudflare:workers", "node:stream"],
              },
            },
          },
        },
      });
    }

    return baseConfig;
  },
});
