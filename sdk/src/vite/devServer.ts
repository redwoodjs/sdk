import type { ViteDevServer } from "vite";

export let devServer: ViteDevServer | undefined;

export function setDevServer(server: ViteDevServer) {
  devServer = server;
}
