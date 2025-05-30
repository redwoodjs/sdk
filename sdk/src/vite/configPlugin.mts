import { Plugin } from "vite";
import { resolve } from "node:path";
import { mergeConfig, InlineConfig } from "vite";

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
          optimizeDeps: {
            noDiscovery: false,
            esbuildOptions: {
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
          optimizeDeps: {
            noDiscovery: false,
            esbuildOptions: {
              treeShaking: false,
              conditions: ["workerd"],
              plugins: [],
            },
            include: [],
            exclude: [],
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
              plugins: [],
            },
            include: [],
            exclude: [],
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
          await builder.build(builder.environments["rsc"]!);
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
