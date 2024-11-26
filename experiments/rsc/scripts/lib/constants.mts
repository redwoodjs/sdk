import { resolve } from "node:path";

export const ROOT_DIR = resolve(__dirname, "..");
export const DIST_DIR = resolve(ROOT_DIR, "dist");
export const VENDOR_DIST_DIR = resolve(ROOT_DIR, "vendor/dist");

export const DEV_SERVER_PORT = 2332;
export const WORKER_DEV_SERVER_PORT = 5174;

export const RELATIVE_WORKER_PATHNAME = "src/worker.tsx";

export const D1_PERSIST_PATH = resolve(ROOT_DIR, ".wrangler/state/v3/d1");
