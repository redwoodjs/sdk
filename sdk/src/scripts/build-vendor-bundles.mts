import { resolve } from "node:path";
import { build, mergeConfig, type InlineConfig } from "vite";
import { $ } from "../lib/$.mjs";
import { VENDOR_DIST_DIR, VENDOR_SRC_DIR } from "../lib/constants.mjs";

const __dirname = new URL(".", import.meta.url).pathname;

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
      build: {
        outDir: VENDOR_DIST_DIR,
        lib: {
          entry: resolve(VENDOR_SRC_DIR, "react-server-internals.js"),
          name: "react-server-internals",
          formats: ["es"],
          fileName: () => `react-server-internals.${mode}.js`,
        },
      },
      resolve: {
        conditions: ["react-server"],
      },
    }),
  react: (mode: "development" | "production"): InlineConfig =>
    mergeConfig(createConfig(mode)(), {
      build: {
        outDir: VENDOR_DIST_DIR,
        lib: {
          entry: resolve(VENDOR_SRC_DIR, "react.js"),
          name: "react",
          formats: ["es"],
          fileName: () => `react.${mode}.js`,
        },
      },
      resolve: {
        alias: {
          "react-server-internals": resolve(
            VENDOR_DIST_DIR,
            `react-server-internals.${mode}.js`
          ),
        },
      },
    }),
  reactDomServerEdge: (mode: "development" | "production"): InlineConfig =>
    mergeConfig(createConfig(mode)(), {
      build: {
        outDir: VENDOR_DIST_DIR,
        lib: {
          entry: resolve(VENDOR_SRC_DIR, "react-dom-server-edge.js"),
          name: "react-dom-server-edge",
          formats: ["es"],
          fileName: () => `react-dom-server-edge.${mode}.js`,
        },
        rollupOptions: {
          external: ["react"],
        },
      },
    }),
  jsxRuntime: (mode: "development" | "production"): InlineConfig =>
    mergeConfig(createConfig(mode)(), {
      build: {
        outDir: VENDOR_DIST_DIR,
        lib: {
          entry: resolve(VENDOR_SRC_DIR, "jsx-runtime.js"),
          name: "jsx-runtime",
          formats: ["es"],
          fileName: () => `jsx-runtime.${mode}.js`,
        },
        rollupOptions: {
          external: ["react"],
        },
      },
    }),
  jsxDevRuntime: (mode: "development" | "production"): InlineConfig =>
    mergeConfig(createConfig(mode)(), {
      build: {
        outDir: VENDOR_DIST_DIR,
        lib: {
          entry: resolve(VENDOR_SRC_DIR, "jsx-dev-runtime.js"),
          name: "jsx-dev-runtime",
          formats: ["es"],
          fileName: () => `jsx-dev-runtime.${mode}.js`,
        },
        rollupOptions: {
          external: ["react"],
        },
      },
    }),
};

export const buildVendorBundles = async () => {
  await $`pnpm clean:vendor`;

  const bundles = [
    "reactServerInternals",
    "react",
    "reactDomServerEdge",
    "jsxRuntime",
    "jsxDevRuntime",
  ] as const;

  for (const mode of ["development", "production"] as const) {
    for (const bundle of bundles) {
      await build(configs[bundle](mode));
    }
  }
};

if (import.meta.url === new URL(process.argv[1], import.meta.url).href) {
  buildVendorBundles();
}
