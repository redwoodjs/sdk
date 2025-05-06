import { resolve } from "node:path";
import { build, mergeConfig, type InlineConfig } from "vite";
import { $ } from "../lib/$.mjs";
import { VENDOR_DIST_DIR, VENDOR_SRC_DIR } from "../lib/constants.mjs";
import { unlink } from "fs/promises";
import { pathExists } from "fs-extra";

const createConfig = (mode: "development" | "production"): InlineConfig => ({
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

const configs = {
  // Build react internals with server conditions
  reactServerInternals: (mode: "development" | "production"): InlineConfig =>
    mergeConfig(createConfig(mode), {
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

  // Build custom React implementation (for both development and production)
  react: (mode: "development" | "production"): InlineConfig =>
    mergeConfig(createConfig(mode), {
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
            `react-server-internals.${mode}.js`,
          ),
        },
      },
    }),
};

export const buildVendorBundles = async () => {
  console.log("Cleaning vendor directory...");
  await $`pnpm clean:vendor`;

  // Build for both development and production modes
  const modes = ["development", "production"] as const;

  // Build the temporary server internals files first
  console.log("Building react-server-internals...");
  for (const mode of modes) {
    await build(configs.reactServerInternals(mode));
  }

  // Build React using the server internals
  console.log("Building React custom builds...");
  for (const mode of modes) {
    await build(configs.react(mode));
  }

  // Clean up temporary server internals files
  console.log("Cleaning up temporary server internals files...");
  for (const mode of modes) {
    const serverInternalsFile = resolve(
      VENDOR_DIST_DIR,
      `react-server-internals.${mode}.js`,
    );
    const serverInternalsMapFile = `${serverInternalsFile}.map`;

    try {
      // Delete the server internals JavaScript file
      if (await pathExists(serverInternalsFile)) {
        await unlink(serverInternalsFile);
      }

      // Delete the source map file if it exists
      if (await pathExists(serverInternalsMapFile)) {
        await unlink(serverInternalsMapFile);
      }
    } catch (error) {
      console.warn(`Warning: Failed to delete ${serverInternalsFile}`, error);
    }
  }

  console.log("Done building vendor bundles");
};

if (import.meta.url === new URL(process.argv[1], import.meta.url).href) {
  buildVendorBundles();
}
