import { Plugin } from "vite";
import path, { resolve } from "node:path";
import { mergeConfig, InlineConfig } from "vite";
import enhancedResolve from "enhanced-resolve";
import { SSR_BRIDGE_PATH } from "../lib/constants.mjs";
import { builtinModules } from "node:module";

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
            conditions: ["workerd"],
            noExternal: true,
          },
          define: {
            "import.meta.env.RWSDK_ENV": JSON.stringify("ssr"),
          },
          optimizeDeps: {
            noDiscovery: false,
            entries: [workerEntryPathname],
            exclude: ["cloudflare:workers", ...builtinModules],
            include: ["rwsdk/__ssr_bridge"],
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
            conditions: ["workerd", "react-server"],
            noExternal: true,
          },
          define: {
            "import.meta.env.RWSDK_ENV": JSON.stringify("worker"),
          },
          optimizeDeps: {
            noDiscovery: false,
            include: [],
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
