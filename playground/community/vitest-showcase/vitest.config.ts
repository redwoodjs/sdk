import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
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
