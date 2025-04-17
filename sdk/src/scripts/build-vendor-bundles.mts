import { resolve } from "node:path";
import { build, mergeConfig, type InlineConfig } from "vite";
import { $ } from "../lib/$.mjs";
import { VENDOR_DIST_DIR, VENDOR_SRC_DIR } from "../lib/constants.mjs";

const createConfig = (
  mode: "development" | "production"
): (() => InlineConfig) => {
  return () => ({
    mode,
    plugins: [],
    logLevel: process.env.VERBOSE ? "info" : "error",
    build: {
      emptyOutDir: false,
      sourcemap: true,
      minify: mode === "production",
    },
    define: {
      "process.env.NODE_ENV": JSON.stringify(mode),
    },
  });
};

const configs = {
  reactServerInternals: (mode: "development" | "production"): InlineConfig =>
    mergeConfig(createConfig(mode)(), {
      resolve: {
        conditions: ["react-server"],
      },
      build: {
        outDir: VENDOR_DIST_DIR,
        lib: {
          entry: resolve(VENDOR_SRC_DIR, "react-server-internals.js"),
          name: "react-server-internals",
          formats: ["es"],
          fileName: () => `react-server-internals.${mode}.js`,
        },
      },
    }),

  // Worker environment bundles
  workerReact: (mode: "development" | "production"): InlineConfig =>
    mergeConfig(createConfig(mode)(), {
      resolve: {
        conditions: ["react-server"],
        alias: {
          "react-server-internals": resolve(
            VENDOR_DIST_DIR,
            `react-server-internals.${mode}.js`
          ),
        },
      },
      build: {
        outDir: VENDOR_DIST_DIR,
        lib: {
          entry: resolve(VENDOR_SRC_DIR, "react.worker.js"),
          name: "react",
          formats: ["es"],
          fileName: () => `react.worker.${mode}.js`,
        },
      },
    }),

  reactDomWorker: (mode: "development" | "production"): InlineConfig =>
    mergeConfig(createConfig(mode)(), {
      resolve: {
        conditions: ["react-server"],
      },
      build: {
        outDir: VENDOR_DIST_DIR,
        lib: {
          entry: resolve(VENDOR_SRC_DIR, "react-dom.worker.js"),
          name: "react-dom",
          formats: ["es"],
          fileName: () => `react-dom.worker.${mode}.js`,
        },
        rollupOptions: {
          external: ["react"],
        },
      },
    }),

  reactDomServer: (mode: "development" | "production"): InlineConfig =>
    mergeConfig(createConfig(mode)(), {
      build: {
        outDir: VENDOR_DIST_DIR,
        lib: {
          entry: resolve(VENDOR_SRC_DIR, "react-dom.server.js"),
          name: "react-dom-server",
          formats: ["es"],
          fileName: () => `react-dom.server.${mode}.js`,
        },
        rollupOptions: {
          external: ["react"],
        },
      },
    }),

  reactDomClient: (mode: "development" | "production"): InlineConfig =>
    mergeConfig(createConfig(mode)(), {
      resolve: {
        conditions: ["react-server"],
      },
      build: {
        outDir: VENDOR_DIST_DIR,
        lib: {
          entry: resolve(VENDOR_SRC_DIR, "react-dom.client.js"),
          name: "react-dom",
          formats: ["es"],
          fileName: () => `react-dom.client.${mode}.js`,
        },
        rollupOptions: {
          external: ["react"],
        },
      },
    }),

  // Client environment bundles
  clientReact: (mode: "development" | "production"): InlineConfig =>
    mergeConfig(createConfig(mode)(), {
      resolve: {
        conditions: ["react-server"],
      },
      build: {
        outDir: VENDOR_DIST_DIR,
        lib: {
          entry: resolve(VENDOR_SRC_DIR, "react.client.js"),
          name: "react",
          formats: ["es"],
          fileName: () => `react.client.${mode}.js`,
        },
      },
    }),

  jsxRuntime: (
    mode: "development" | "production",
    env: "worker" | "client"
  ): InlineConfig =>
    mergeConfig(createConfig(mode)(), {
      resolve: {
        conditions: ["react-server"],
      },
      build: {
        outDir: VENDOR_DIST_DIR,
        lib: {
          entry: resolve(VENDOR_SRC_DIR, "jsx-runtime.js"),
          name: "jsx-runtime",
          formats: ["es"],
          fileName: () => `jsx-runtime.${env}.${mode}.js`,
        },
        rollupOptions: {
          external: ["react"],
        },
      },
    }),

  jsxDevRuntime: (
    mode: "development" | "production",
    env: "worker" | "client"
  ): InlineConfig =>
    mergeConfig(createConfig(mode)(), {
      resolve: {
        conditions: ["react-server"],
      },
      build: {
        outDir: VENDOR_DIST_DIR,
        lib: {
          entry: resolve(VENDOR_SRC_DIR, "jsx-dev-runtime.js"),
          name: "jsx-dev-runtime",
          formats: ["es"],
          fileName: () => `jsx-dev-runtime.${env}.${mode}.js`,
        },
        rollupOptions: {
          external: ["react"],
        },
      },
    }),

  // RSC bundles
  rsdwClientBrowser: (mode: "development" | "production"): InlineConfig =>
    mergeConfig(createConfig(mode)(), {
      resolve: {
        conditions: ["browser", "import"],
      },
      build: {
        outDir: VENDOR_DIST_DIR,
        lib: {
          entry: resolve(
            VENDOR_SRC_DIR,
            "react-server-dom-webpack.client.browser.js"
          ),
          name: "react-server-dom-webpack-client-browser",
          formats: ["es"],
          fileName: () => `react-server-dom-webpack.client.browser.${mode}.js`,
        },
        rollupOptions: {
          external: ["react", "react-dom"],
        },
      },
    }),

  rsdwClientEdge: (mode: "development" | "production"): InlineConfig =>
    mergeConfig(createConfig(mode)(), {
      resolve: {
        conditions: ["react-server"],
      },
      build: {
        outDir: VENDOR_DIST_DIR,
        lib: {
          entry: resolve(
            VENDOR_SRC_DIR,
            "react-server-dom-webpack.client.edge.js"
          ),
          name: "react-server-dom-webpack-client-edge",
          formats: ["es"],
          fileName: () => `react-server-dom-webpack.client.edge.${mode}.js`,
        },
        rollupOptions: {
          external: ["react", "react-dom"],
        },
      },
    }),

  rsdwServerEdge: (mode: "development" | "production"): InlineConfig =>
    mergeConfig(createConfig(mode)(), {
      resolve: {
        conditions: ["react-server"],
      },
      build: {
        outDir: VENDOR_DIST_DIR,
        lib: {
          entry: resolve(
            VENDOR_SRC_DIR,
            "react-server-dom-webpack.server.edge.js"
          ),
          name: "react-server-dom-webpack-server-edge",
          formats: ["es"],
          fileName: () => `react-server-dom-webpack.server.edge.${mode}.js`,
        },
        rollupOptions: {
          external: ["react", "react-dom"],
        },
      },
    }),
};

export const buildVendorBundles = async () => {
  await $`pnpm clean:vendor`;

  const modes = ["development", "production"] as const;
  const envs = ["worker", "client"] as const;

  // Build server internals first
  for (const mode of modes) {
    await build(configs.reactServerInternals(mode));
  }

  // Build environment-specific bundles
  for (const mode of modes) {
    await build(configs.reactDomServer(mode));
    await build(configs.reactDomWorker(mode));
    await build(configs.reactDomClient(mode));

    // Build RSC bundles
    await build(configs.rsdwClientBrowser(mode));
    await build(configs.rsdwClientEdge(mode));
    await build(configs.rsdwServerEdge(mode));

    for (const env of envs) {
      await build(configs.jsxRuntime(mode, env));
      await build(configs.jsxDevRuntime(mode, env));
    }
    // These have their env baked into the source
    await build(configs.workerReact(mode));
    await build(configs.clientReact(mode));
  }
};

if (import.meta.url === new URL(process.argv[1], import.meta.url).href) {
  buildVendorBundles();
}
