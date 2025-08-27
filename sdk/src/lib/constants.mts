import { resolve } from "node:path";

const __dirname = new URL(".", import.meta.url).pathname;

export const ROOT_DIR = resolve(__dirname, "..", "..");

export const SRC_DIR = resolve(ROOT_DIR, "src");
export const DIST_DIR = resolve(ROOT_DIR, "dist");
export const VITE_DIR = resolve(ROOT_DIR, "src", "vite");

// Intermediate paths for the SSR build (Phase 3)
export const SSR_OUTPUT_DIR = resolve(DIST_DIR, "ssr");
export const SSR_BRIDGE_PATH = resolve(SSR_OUTPUT_DIR, "__ssr_bridge.js");
export const SSR_CLIENT_LOOKUP_PATH = resolve(
  SSR_OUTPUT_DIR,
  "__client_lookup.mjs",
);
export const SSR_SERVER_LOOKUP_PATH = resolve(
  SSR_OUTPUT_DIR,
  "__server_lookup.mjs",
);

// Final paths for the worker and its dependencies (Phase 4)
export const WORKER_OUTPUT_DIR = resolve(DIST_DIR, "worker");
export const WORKER_SSR_BRIDGE_PATH = resolve(
  WORKER_OUTPUT_DIR,
  "__ssr_bridge.js",
);
export const WORKER_CLIENT_LOOKUP_PATH = resolve(
  WORKER_OUTPUT_DIR,
  "__client_lookup.mjs",
);
export const WORKER_SERVER_LOOKUP_PATH = resolve(
  WORKER_OUTPUT_DIR,
  "__server_lookup.mjs",
);
