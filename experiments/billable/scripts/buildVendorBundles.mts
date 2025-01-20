import { resolve } from "node:path";
import dts from "vite-plugin-dts";
import { build, mergeConfig, type InlineConfig } from "vite";
import { $ } from './lib/$.mjs';

const __dirname = new URL(".", import.meta.url).pathname;

const DEST_DIR = resolve(__dirname, "../vendor/dist");
const SRC_DIR = resolve(__dirname, "../vendor/src");

const MODE =
  process.env.NODE_ENV === "development" ? "development" : "production";

const configs = {
  common: (): InlineConfig => ({
    mode: MODE,
    plugins: [
      [
        dts({
          rollupTypes: true,
          tsconfigPath: resolve(__dirname, "../tsconfig.vendor.json"),
        }),
      ],
    ],
    logLevel: process.env.VERBOSE ? "info" : "error",
    build: {
      emptyOutDir: false,
      sourcemap: true,
      minify: MODE === "production",
    },
    optimizeDeps: {
      noDiscovery: false,
      include: [
        "react",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "react-dom/server.edge",
        "@prisma/client",
      ],
    },
  }),
  reactSSR: (): InlineConfig =>
    mergeConfig(configs.common(), {
      build: {
        outDir: DEST_DIR,
        lib: {
          entry: resolve(SRC_DIR, "react-ssr.ts"),
          name: "react-ssr",
          formats: ["es"],
          fileName: "react-ssr",
        },
      },
    }),
  react: (): InlineConfig =>
    mergeConfig(configs.common(), {
      build: {
        outDir: DEST_DIR,
        lib: {
          entry: resolve(SRC_DIR, "react.ts"),
          name: "react",
          formats: ["es"],
          fileName: "react",
        },
        rollupOptions: {
          conditions: ['react-server'],
          external: ['vendor/react-ssr'],
        },
      },
    }),
};

export const buildVendorBundles = async () => {
  console.log("Building vendor bundles...");
  await $`pnpm clean:vendor`;
  await build(configs.reactSSR());
  await build(configs.react());
};

if (import.meta.url === new URL(process.argv[1], import.meta.url).href) {
  buildVendorBundles();
}
