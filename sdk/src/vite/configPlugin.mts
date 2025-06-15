import { Plugin } from "vite";
import path, { resolve } from "node:path";
import { mergeConfig, InlineConfig } from "vite";
import enhancedResolve from "enhanced-resolve";
import { SSR_BRIDGE_PATH } from "../lib/constants.mjs";
import { builtinModules } from "node:module";

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
              input: {
                client: clientEntryPathname,
              },
            },
          },
          define: {
            "import.meta.env.RWSDK_ENV": JSON.stringify("client"),
          },
          optimizeDeps: {
            noDiscovery: false,
            include: ["rwsdk/client"],
            entries: ["virtual:use-client-lookup", "virtual:use-server-lookup"],
            esbuildOptions: {
              jsx: "automatic",
              jsxImportSource: "react",
              plugins: [],
              define: {
                "process.env.NODE_ENV": JSON.stringify(mode),
              },
            },
          },
        },
        ssr: {
          resolve: {
            conditions: [
              "workerd",
              // context(justinvdm, 11 Jun 2025): Some packages meant for cloudflare workers, yet
              // their deps have only node import conditions, e.g. `agents` package (meant for CF),
              // has `pkce-challenge` package as a dep, which has only node import conditions.
              // https://github.com/crouchcd/pkce-challenge/blob/master/package.json#L17
              //
              // Once the transformed code for this environment is in turn processed in the `worker` environment,
              // @cloudflare/vite-plugin should take care of any relevant polyfills for deps with
              // node builtins imports that can be polyfilled though, so it is worth us including this condition here.
              // However, it does mean we will try to run packages meant for node that cannot be run on cloudflare workers.
              // That's the trade-off, but arguably worth it. (context(justinvdm, 11 Jun 2025))
              "node",
            ],
            noExternal: true,
          },
          define: {
            "import.meta.env.RWSDK_ENV": JSON.stringify("ssr"),
          },
          optimizeDeps: {
            noDiscovery: false,
            entries: [
              workerEntryPathname,
              "virtual:use-client-lookup",
              "virtual:use-server-lookup",
            ],
            exclude: externalModules,
            include: ["rwsdk/__ssr", "rwsdk/__ssr_bridge"],
            esbuildOptions: {
              jsx: "automatic",
              jsxImportSource: "react",
              conditions: ["workerd"],
              plugins: [],
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
          },
        },
        worker: {
          resolve: {
            conditions: [
              "workerd",
              "react-server",
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
          // * When building, client needs to be build first, so that we have a
          //   manifest file to map to when looking at asset references in JSX
          //   (e.g. Document.tsx)
          // * When bundling, the RSC build imports the SSR build - this way
          //   they each can have their own environments (e.g. with their own
          //   import conditions), while still having all worker-run code go
          //   through the processing done by `@cloudflare/vite-plugin`

          await builder.build(builder.environments["client"]!);
          await builder.build(builder.environments["ssr"]!);
          await builder.build(builder.environments["worker"]!);
        },
      },
    };

    return baseConfig;
  },
});
