import { mergeConfig, ViteDevServer, type InlineConfig } from "vite";
import { resolve } from "node:path";
import {
  RELATIVE_WORKER_PATHNAME,
  ROOT_DIR,
  VENDOR_DIST_DIR,
} from "./constants.mjs";

const MODE =
  process.env.NODE_ENV === "development" ? "development" : "production";

export type DevConfigContext = {
  rebuildWorker: () => Promise<void>;
};

export const viteConfigs = {
  common: (): InlineConfig => ({
    mode: MODE,
    environments: {
      worker: {
        resolve: {
          conditions: ["workerd"],
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
    plugins: [],
    server: {
      middlewareMode: true,
    },
  }),
  dev: (context: DevConfigContext): InlineConfig =>
    mergeConfig(viteConfigs.common(), {
      mode: "development",
      build: {
        minify: false,
        sourcemap: true,
        rollupOptions: {
          input: {
            worker: resolve(ROOT_DIR, RELATIVE_WORKER_PATHNAME),
          },
          preserveEntrySignatures: "exports-only",
        },

        // todo(justinvdm, 2024-11-21): Figure out what is making our bundle so large. React SSR and SRC bundles account for ~1.5MB.
        // todo(justinvdm, 2024-11-21): Figure out if we can do some kind of code-splitting with Miniflare
        chunkSizeWarningLimit: 4_000,
      },
      plugins: [hmrPlugin(context)],
    }),
  deploy: (): InlineConfig =>
    mergeConfig(viteConfigs.common(), {
      mode: MODE,
      build: {
        sourcemap: true,
        outDir: resolve(__dirname, "../dist"),
        lib: {
          entry: resolve(ROOT_DIR, RELATIVE_WORKER_PATHNAME),
          name: "worker",
          formats: ["es"],
          fileName: "worker",
        },
      },
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

    if (isImportedByWorkerFile) {
      await rebuildWorker();
      // todo(justinvdm, 2024-11-19): Send RSC update to client
    }
  },
});
