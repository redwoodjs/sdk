import { Plugin } from "vite";
import path, { resolve } from "node:path";
import { builtinModules } from "node:module";
import { InlineConfig } from "vite";
import enhancedResolve from "enhanced-resolve";

import { SSR_BRIDGE_PATH, SSR_CLIENT_LOOKUP_PATH } from "../lib/constants.mjs";

// port(justinvdm, 09 Jun 2025):
// https://github.com/cloudflare/workers-sdk/blob/d533f5ee7da69c205d8d5e2a5f264d2370fc612b/packages/vite-plugin-cloudflare/src/cloudflare-environment.ts#L123-L128
export const cloudflareBuiltInModules = [
  "cloudflare:email",
  "cloudflare:sockets",
  "cloudflare:workers",
  "cloudflare:workflows",
];

export const externalModules = [
  ...cloudflareBuiltInModules,
  ...builtinModules,
  ...builtinModules.map((m) => `node:${m}`),
];

export const configPlugin = ({
  silent,
  projectRootDir,
  workerEntryPathname,
  clientFiles,
  clientEntryPoints,
}: {
  silent: boolean;
  projectRootDir: string;
  workerEntryPathname: string;
  clientFiles: Set<string>;
  clientEntryPoints: Set<string>;
}): Plugin => ({
  name: "rwsdk:config",
  config: async (_) => {
    const mode = process.env.NODE_ENV;
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
            exclude: externalModules,
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
              entry: {},
              formats: ["es"],
            },
            outDir: path.dirname(SSR_BRIDGE_PATH),
            rollupOptions: {
              output: {
                entryFileNames: (chunkInfo) => {
                  if (chunkInfo.name === "virtual:use-client-lookup.js") {
                    return "__client_lookup.mjs";
                  }

                  if (
                    chunkInfo.name === path.basename(SSR_BRIDGE_PATH, ".js")
                  ) {
                    return path.basename(SSR_BRIDGE_PATH);
                  }

                  return "client-components/[name]-[hash].mjs";
                },
                chunkFileNames: "client-components/[name]-[hash].mjs",
              },
            },
          },
        },
        worker: {
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
      builder: {
        buildApp: async (builder) => {
          // Phase 1: Worker "Discovery" Pass
          console.log("Phase 1: Worker 'Discovery' Pass");
          await builder.build(builder.environments["worker"]!);

          // Phase 2: Client Build
          console.log("Phase 2: Client Build");
          const clientConfig = builder.environments.client;
          if (
            clientConfig?.build?.rollupOptions &&
            typeof clientConfig.build.rollupOptions.input !== "string" &&
            !Array.isArray(clientConfig.build.rollupOptions.input)
          ) {
            clientConfig.build.rollupOptions.input =
              Array.from(clientEntryPoints);
          }
          await builder.build(clientConfig!);

          // Phase 3: SSR Build
          console.log("Phase 3: SSR Build");
          const ssrConfig = builder.environments.ssr;
          if (ssrConfig?.build?.lib) {
            const ssrEntries: Record<string, string> = {
              [path.basename(SSR_BRIDGE_PATH, ".js")]: enhancedResolve.sync(
                projectRootDir,
                "rwsdk/__ssr_bridge",
              ) as string,
              "virtual:use-client-lookup.js": "virtual:use-client-lookup.js",
            };
            for (const file of clientFiles) {
              ssrEntries[file] = path.resolve(projectRootDir, file);
            }
            ssrConfig.build.lib.entry = ssrEntries;
          }
          await builder.build(ssrConfig!);

          // Phase 4: Worker "Linking" and "SSR-rebundling" Pass
          console.log('Phase 4: Worker "Linking" and "SSR-rebundling" Pass');
          await builder.build(builder.environments["worker"]!);
        },
      },
    };

    return baseConfig;
  },
});
