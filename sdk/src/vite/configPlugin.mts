import { Plugin } from "vite";
import path, { resolve } from "node:path";
import { InlineConfig } from "vite";
import enhancedResolve from "enhanced-resolve";
import debug from "debug";

import { INTERMEDIATE_SSR_BRIDGE_PATH } from "../lib/constants.mjs";
import { buildApp } from "./buildApp.mjs";
import { EXTERNAL_MODULES } from "./constants.mjs";

const log = debug("rwsdk:vite:config");

export const configPlugin = ({
  silent,
  projectRootDir,
  workerEntryPathname,
  clientFiles,
  serverFiles,
  clientEntryPoints,
}: {
  silent: boolean;
  projectRootDir: string;
  workerEntryPathname: string;
  clientFiles: Set<string>;
  serverFiles: Set<string>;
  clientEntryPoints: Set<string>;
}): Plugin => ({
  name: "rwsdk:config",
  config: async (_) => {
    const mode = process.env.NODE_ENV;

    const workerConfig: InlineConfig = {
      resolve: {
        conditions: [
          "workerd",
          "react-server",
          "module",
          // context(justinvdm, 11 Jun 2025): Some packages meant for cloudflare workers, yet
          // their deps have only node import conditions, e.g. `agents` package (meant for CF),
          // has `pkce-challenge` package as a dep, which has only node import conditions.
          // https://github.com/crouchcd/pkce-challenge/blob/master/package.json#L17
          //
          // @cloudflare/vite-plugin should take care of any relevant polyfills for deps with
          // node builtins imports that can be polyfilled though, so it is worth us including this condition here.
          // However, it does mean we will try to run packages meant for node that cannot be run on cloudflare workers.
          // That's the trade-off, but arguably worth it.
          "node",
        ],
        noExternal: true,
      },
      define: {
        "import.meta.env.RWSDK_ENV": JSON.stringify("worker"),
      },
      optimizeDeps: {
        noDiscovery: false,
        include: ["rwsdk/worker"],
        exclude: [],
        entries: [workerEntryPathname],
        esbuildOptions: {
          jsx: "automatic",
          jsxImportSource: "react",
          define: {
            "process.env.NODE_ENV": JSON.stringify(mode),
          },
        },
      },
      build: {
        outDir: resolve(projectRootDir, "dist", "worker"),
        emitAssets: true,
        emptyOutDir: false,
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
    };

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
      ssr: {
        target: "webworker",
      },
      environments: {
        client: {
          consumer: "client",
          build: {
            outDir: resolve(projectRootDir, "dist", "client"),
            manifest: true,
            rollupOptions: {
              input: [],
            },
          },
          define: {
            "import.meta.env.RWSDK_ENV": JSON.stringify("client"),
          },
          optimizeDeps: {
            noDiscovery: false,
            include: ["rwsdk/client"],
            entries: [],
            esbuildOptions: {
              jsx: "automatic",
              jsxImportSource: "react",
              plugins: [],
              define: {
                "process.env.NODE_ENV": JSON.stringify(mode),
              },
            },
          },
          resolve: {
            conditions: ["browser", "module"],
          },
        },
        ssr: {
          resolve: {
            conditions: ["workerd", "module", "browser"],
            noExternal: true,
          },
          define: {
            "import.meta.env.RWSDK_ENV": JSON.stringify("ssr"),
          },
          optimizeDeps: {
            noDiscovery: false,
            entries: [workerEntryPathname],
            exclude: EXTERNAL_MODULES,
            include: ["rwsdk/__ssr", "rwsdk/__ssr_bridge"],
            esbuildOptions: {
              jsx: "automatic",
              jsxImportSource: "react",
              plugins: [],
              define: {
                "process.env.NODE_ENV": JSON.stringify(mode),
              },
            },
          },
          build: {
            lib: {
              entry: {
                [path.basename(INTERMEDIATE_SSR_BRIDGE_PATH, ".js")]:
                  enhancedResolve.sync(
                    projectRootDir,
                    "rwsdk/__ssr_bridge",
                  ) as string,
              },
              formats: ["es"],
              fileName: () => path.basename(INTERMEDIATE_SSR_BRIDGE_PATH),
            },
            outDir: path.dirname(INTERMEDIATE_SSR_BRIDGE_PATH),
            rollupOptions: {
              output: {
                inlineDynamicImports: true,
              },
            },
          },
        },
        worker: workerConfig,
      },
      server: {
        hmr: true,
      },
      builder: {
        async buildApp(builder) {
          await buildApp({
            builder,
            projectRootDir,
            clientEntryPoints,
            clientFiles,
            serverFiles,
          });
        },
      },
    };

    return baseConfig;
  },
});
