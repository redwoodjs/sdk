import { cloudflare } from "@cloudflare/vite-plugin";
import { redwood } from "rwsdk/vite";
import { defineConfig } from "vite";

export default defineConfig({
  environments: {
    ssr: {
      define: {
        // context(justinvdm, 2 Oct 2025): @xterm/xterm accesses navigator.platform at module load time
        // (https://github.com/xtermjs/xterm.js/blob/a1d8e96fdd5ed93329b5af09106f5a3c6cd5740b/src/common/Platform.ts#L19)
        // which is undefined in Cloudflare Workers during SSR. Vite's define performs a text replacement
        // at build time, so navigator.platform becomes "CloudflareWorkers" before evaluation.
        "navigator.platform": JSON.stringify("CloudflareWorkers"),
        // context(justinvdm, 2 Oct 2025): @xterm/xterm also references window, which doesn't exist in
        // Cloudflare Workers. Replace with globalThis which is available in the worker environment.
        window: "globalThis",
      },
    },
  },
  plugins: [
    cloudflare({
      viteEnvironment: { name: "worker" },
    }),
    redwood(),
  ],
});
