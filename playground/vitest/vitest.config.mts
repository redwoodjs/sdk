import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";
import { cloudflare } from "@cloudflare/vite-plugin";
import { redwood } from "rwsdk/vite";

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        wrangler: { configPath: "./wrangler.jsonc" },
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
