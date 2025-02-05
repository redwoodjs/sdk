import { resolve } from "node:path";
import { build, mergeConfig, type InlineConfig } from "vite";
import { $ } from '../lib/$.mjs';
import { VENDOR_DIST_DIR, VENDOR_SRC_DIR } from '../lib/constants.mjs';

const __dirname = new URL(".", import.meta.url).pathname;

const MODE =
  process.env.NODE_ENV === "development" ? "development" : "production";

const configs = {
  common: (): InlineConfig => ({
    mode: MODE,
    plugins: [],
    logLevel: process.env.VERBOSE ? "info" : "error",
    build: {
      emptyOutDir: false,
      sourcemap: true,
      minify: MODE === "production",
    },
  }),
  reactServerInternals: (): InlineConfig =>
    mergeConfig(configs.common(), {
      build: {
        outDir: VENDOR_DIST_DIR,
        lib: {
          entry: resolve(VENDOR_SRC_DIR, "react-server-internals.js"),
          name: "react-server-internals",
          formats: ["es"],
          fileName: "react-server-internals",
        },
      },
      resolve: {
        conditions: ['react-server'],
      },
    }),
  react: (): InlineConfig =>
    mergeConfig(configs.common(), {
      build: {
        outDir: VENDOR_DIST_DIR,
        lib: {
          entry: resolve(VENDOR_SRC_DIR, "react.js"),
          name: "react",
          formats: ["es"],
          fileName: "react",
        },
      },
      resolve: {
        alias: {
          'react-server-internals': resolve(VENDOR_DIST_DIR, 'react-server-internals.js'),
        },
      },
    }),
  reactDomServerEdge: (): InlineConfig =>
    mergeConfig(configs.common(), {
      build: {
        outDir: VENDOR_DIST_DIR,
        lib: {
          entry: resolve(VENDOR_SRC_DIR, "react-dom-server-edge.js"),
          name: "react-dom-server-edge",
          formats: ["es"],
          fileName: "react-dom-server-edge",
        },
        rollupOptions: {
          external: ['react'],
        },
      },
    }),

};

export const buildVendorBundles = async () => {
  await $`pnpm clean:vendor`;
  await build(configs.reactServerInternals());
  await build(configs.react());
  await build(configs.reactDomServerEdge());
};

if (import.meta.url === new URL(process.argv[1], import.meta.url).href) {
  buildVendorBundles();
}
