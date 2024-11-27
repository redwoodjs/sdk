import { mergeConfig, ViteDevServer, type InlineConfig } from "vite";
import { resolve } from "node:path";
import {
  DEV_SERVER_PORT,
  DIST_DIR,
  RELATIVE_CLIENT_PATHNAME,
  RELATIVE_WORKER_PATHNAME,
  VENDOR_DIST_DIR,
} from "./constants.mjs";

const MODE =
  process.env.NODE_ENV === "development" ? "development" : "production";

export type DevConfigContext = {
  rebuildWorker: () => Promise<void>;
};

export const viteConfigs = {
  main: (): InlineConfig => ({
    mode: MODE,
    build: {
      assetsInlineLimit: 0,
      minify: MODE === "development",
      ssrEmitAssets: true,
      emitAssets: true,
    },
    environments: {
      client: {
        consumer: "client",
        build: {
          rollupOptions: {
            input: {
              client: RELATIVE_CLIENT_PATHNAME,
            },
          },
        },
      },
      worker: {
        resolve: {
          conditions: ["module", "workerd"],
          noExternal: true,
        },
        build: {
          outDir: DIST_DIR,
          ssr: true,
          rollupOptions: {
            input: {
              worker: RELATIVE_WORKER_PATHNAME,
            },
          },
        },
      },
    },
    resolve: {
      alias: {
        "vendor/react-ssr": resolve(VENDOR_DIST_DIR, "react-ssr.mjs"),
        "vendor/react-rsc-worker": resolve(
          VENDOR_DIST_DIR,
          "react-rsc-worker.mjs",
        ),
      },
    },
    server: {
      middlewareMode: true,
      port: DEV_SERVER_PORT,
    },
    define: {
      "process.env.NODE_ENV": JSON.stringify(MODE),
    },
  }),
  dev: (context: DevConfigContext): InlineConfig =>
    mergeConfig(viteConfigs.main(), {
      plugins: [hmrPlugin(context)],
    }),
};

// context(justinvdm, 2024-11-20): While it may seem odd to use the dev server and HMR only to do full rebuilds,
// we leverage the dev server's module graph to efficiently determine if the worker bundle needs to be
// rebuilt. This allows us to avoid unnecessary rebuilds when changes don't affect the worker.
// Still, first prize would be to not need to rebundle at all.
const hmrPlugin = ({ rebuildWorker }: DevConfigContext) => ({
  name: "rw-reloaded-hmr",
  handleHotUpdate: async ({
    file,
    server,
  }: {
    file: string;
    server: ViteDevServer;
  }) => {
    const module = server.moduleGraph.getModuleById(file);

    const isImportedByWorkerFile = [...(module?.importers || [])].some(
      (importer) => importer.file === resolve("/", RELATIVE_WORKER_PATHNAME),
    );

    // todo(justinvdm, 2024-11-19): Send RSC update to client
    if (isImportedByWorkerFile) {
      await rebuildWorker();
    }
  },
});
