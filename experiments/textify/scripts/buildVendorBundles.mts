import { resolve } from "node:path";
import { build, mergeConfig, optimizeDeps, type InlineConfig } from "vite";
import { $ } from './lib/$.mjs';

const __dirname = new URL(".", import.meta.url).pathname;

const DEST_DIR = resolve(__dirname, "../vendor/dist");
const SRC_DIR = resolve(__dirname, "../vendor/src");

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
        outDir: DEST_DIR,
        lib: {
          entry: resolve(SRC_DIR, "react-server-internals.js"),
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
        outDir: DEST_DIR,
        lib: {
          entry: resolve(SRC_DIR, "react.js"),
          name: "react",
          formats: ["es"],
          fileName: "react",
        },
      },
      resolve: {
        alias: {
          'react-server-internals': resolve(DEST_DIR, 'react-server-internals.js'),
        },
      },
    }),
  reactDomServerEdge: (): InlineConfig =>
    mergeConfig(configs.common(), {
      build: {
        outDir: DEST_DIR,
        lib: {
          entry: resolve(SRC_DIR, "react-dom-server-edge.js"),
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
  console.log("Building vendor bundles...");
  await $`pnpm clean:vendor`;
  await build(configs.reactServerInternals());
  await build(configs.react());
  await build(configs.reactDomServerEdge());
};

if (import.meta.url === new URL(process.argv[1], import.meta.url).href) {
  buildVendorBundles();
}
