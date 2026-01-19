import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";
import { vitestPluginRSC } from "vitest-plugin-rsc";

export default defineWorkersConfig({
  plugins: [vitestPluginRSC()],
  test: {
    // Keep worker-pool tests separate from browser-mode tests.
    include: ["src/**/*.worker.test.{ts,tsx}"],
    poolOptions: {
      workers: {
        wrangler: {
          // Use the built worker output (and its generated wrangler.json) so
          // conditional exports like `rwsdk/worker` resolve correctly.
          configPath: "./dist/worker/wrangler.json",
        },
      },
    },
  },
});
