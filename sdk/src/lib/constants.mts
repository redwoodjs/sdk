import { resolve } from "node:path";

const __dirname = new URL(".", import.meta.url).pathname;

export const ROOT_DIR = resolve(__dirname, "..", "..");

export const SRC_DIR = resolve(ROOT_DIR, "src");
export const DIST_DIR = resolve(ROOT_DIR, "dist");

export const SSR_BRIDGE_PATH = resolve(DIST_DIR, "worker", "__ssr_bridge.js");
