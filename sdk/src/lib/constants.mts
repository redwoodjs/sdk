import path, { resolve } from "node:path";

const __dirname = new URL(".", import.meta.url).pathname;

export const ROOT_DIR = resolve(__dirname, "..", "..");

export const SRC_DIR = resolve(ROOT_DIR, "src");
export const RUNTIME_DIR = resolve(SRC_DIR, "runtime");
export const DIST_DIR = resolve(ROOT_DIR, "dist");
export const VITE_DIR = resolve(ROOT_DIR, "src", "vite");

export const INTERMEDIATES_OUTPUT_DIR = resolve(
  DIST_DIR,
  "__intermediate_builds",
);

export const VENDOR_CLIENT_BARREL_PATH = path.resolve(
  INTERMEDIATES_OUTPUT_DIR,
  "rwsdk-vendor-client-barrel.js",
);
export const VENDOR_SERVER_BARREL_PATH = path.resolve(
  INTERMEDIATES_OUTPUT_DIR,
  "rwsdk-vendor-server-barrel.js",
);

export const VENDOR_CLIENT_BARREL_EXPORT_PATH = "rwsdk/__vendor_client_barrel";
export const VENDOR_SERVER_BARREL_EXPORT_PATH = "rwsdk/__vendor_server_barrel";

export const RW_STATE_EXPORT_PATH = "rwsdk/__state";

export const INTERMEDIATE_SSR_BRIDGE_PATH = resolve(
  INTERMEDIATES_OUTPUT_DIR,
  "ssr",
  "ssr_bridge.js",
);

export const CLIENT_MANIFEST_RELATIVE_PATH = resolve(
  "dist",
  "client",
  ".vite",
  "manifest.json",
);
