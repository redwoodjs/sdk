import { resolve } from "node:path";

const __dirname = new URL(".", import.meta.url).pathname;

export const ROOT_DIR = resolve(__dirname, "..", "..");
export const SRC_DIR = resolve(ROOT_DIR, "src");
export const DIST_DIR = resolve(ROOT_DIR, "dist");

export const CLIENT_DIST_DIR = resolve(DIST_DIR, "client");
export const WORKER_DIST_DIR = resolve(DIST_DIR, "worker");

export const VENDOR_ROOT_DIR = resolve(ROOT_DIR, "vendor");
export const VENDOR_SRC_DIR = resolve(VENDOR_ROOT_DIR, "src");
export const VENDOR_DIST_DIR = resolve(VENDOR_ROOT_DIR, "dist");

export const DEV_SERVER_PORT = 2332;
export const WORKER_DEV_SERVER_PORT = 5174;

export const MANIFEST_PATH = resolve(CLIENT_DIST_DIR, ".vite", "manifest.json");

export const WRANGLER_TOML_PATH = resolve(ROOT_DIR, "wrangler.toml");

export const VENDOR_REACT_SSR_PATH = resolve(VENDOR_DIST_DIR, "react-ssr.js");