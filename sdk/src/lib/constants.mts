import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const ROOT_DIR = resolve(__dirname, "..", "..");

export const SRC_DIR = resolve(ROOT_DIR, "src");
export const DIST_DIR = resolve(ROOT_DIR, "dist");
export const VITE_DIR = resolve(ROOT_DIR, "src", "vite");

export const INTERMEDIATES_OUTPUT_DIR = resolve(
  DIST_DIR,
  "__intermediate_builds",
);

// Intentionally named `.dev-virtual.js`: these files are never written during
// the SDK build. In dev, directiveModulesDevPlugin intercepts the matching
// `rwsdk/__vendor_*_barrel` specifiers and serves generated content from
// in-memory temp barrels. The package.json exports point here only as a
// fallback marker/placeholder for cases where the dev plugin has not set temp
// barrel paths.
export const VENDOR_CLIENT_BARREL_PATH = resolve(
  INTERMEDIATES_OUTPUT_DIR,
  "__vendor_client_barrel.dev-virtual.js",
);
export const VENDOR_SERVER_BARREL_PATH = resolve(
  INTERMEDIATES_OUTPUT_DIR,
  "__vendor_server_barrel.dev-virtual.js",
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
