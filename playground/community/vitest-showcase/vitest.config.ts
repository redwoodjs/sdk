import { defineConfig } from "vitest/config";
import { vitestPluginRSC } from "vitest-plugin-rsc";
import { playwright } from "@vitest/browser-playwright";

export default defineConfig({
  plugins: [vitestPluginRSC()],
  test: {
    restoreMocks: true,
    // Only run this project's tests in browser mode.
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    // Keep worker-pool tests separate from browser-mode tests.
    exclude: ["src/**/*.worker.test.{ts,tsx}"],
    browser: {
      enabled: true,
      provider: playwright() as any,
      screenshotFailures: false,
      instances: [{ browser: "chromium" }],
    },
    setupFiles: ["./src/vitest.setup.ts"],
  },
});
