import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";
import { vitestPluginRSC } from "vitest-plugin-rsc";

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        wrangler: {
          configPath: "./dist/worker/wrangler.json",
        }
      },
    },
  },
  plugins: [vitestPluginRSC()],
});
