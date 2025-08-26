import { Plugin } from "vite";
import path, { resolve } from "node:path";
import { builtinModules } from "node:module";
import { InlineConfig } from "vite";
import enhancedResolve from "enhanced-resolve";

import { SSR_BRIDGE_PATH } from "../lib/constants.mjs";
import { CLIENT_LOOKUP_PATH } from "../lib/constants.mjs";
import { BuildState } from "./redwoodPlugin.mjs";

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
  clientEntryPathnames,
  workerEntryPathname,
  buildState,
}: {
  silent: boolean;
  projectRootDir: string;
  clientEntryPathnames: string[];
  workerEntryPathname: string;
  buildState: BuildState;
}): Plugin => ({
  name: "rwsdk:config",
  rwsdk: {
    buildState,
  },
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
              input: clientEntryPathnames,
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
              entry: {
                [path.basename(SSR_BRIDGE_PATH, ".js")]: enhancedResolve.sync(
                  projectRootDir,
                  "rwsdk/__ssr_bridge",
                ) as string,
              },
              formats: ["es"],
              fileName: () => path.basename(SSR_BRIDGE_PATH),
            },
            outDir: path.dirname(SSR_BRIDGE_PATH),
            manifest: true,
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
          // note(justinvdm, 27 May 2025): **Ordering is important**:
          // The build process is sequential and phased to resolve a circular
          // dependency between the `worker` and `ssr` environments.

          // Phase 1: Client build (for assets)
          await builder.build(builder.environments["client"]!);

          // Phase 2: Initial Worker build (to discover client components)
          await builder.build(builder.environments["worker"]!);

          // Phase 3: Dynamic SSR build
          const ssrEnv = builder.environments["ssr"]!;
          const ssrConfig = ssrEnv.config.build!.lib!;
          const ssrEntries = ssrConfig.entry as Record<string, string>;

          for (const clientComponentPath of buildState.clientComponentPaths) {
            const entryName = path
              .relative(projectRootDir, clientComponentPath)
              .replace(/\//g, path.sep)
              .replace(/\.[^/.]+$/, "");
            ssrEntries[entryName] = clientComponentPath;
          }

          // Also add the client lookup module as an entry to the SSR build
          ssrEntries[path.basename(CLIENT_LOOKUP_PATH, ".mjs")] =
            enhancedResolve.sync(
              projectRootDir,
              "rwsdk/__client_lookup",
            ) as string;

          await builder.build(ssrEnv);

          // Phase 4: Final Worker Re-Bundling Run
          const workerEnv = builder.environments["worker"]!;
          const workerConfig = workerEnv.config.build!.rollupOptions!;
          workerConfig.input = buildState.ssrOutputPaths;

          await builder.build(workerEnv);
        },
      },
    };

    return baseConfig;
  },
});
