import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["playground/**/__tests__/**/*.test.mts"],
    testTimeout: 60000, // 60 seconds for e2e tests
  },
});
