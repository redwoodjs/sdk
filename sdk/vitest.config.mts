import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["../playground/**/__tests__/**/*.test.mts"],
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "../playground/**/node_modules/**",
      "**/@redwoodjs/sdk/**",
    ],
    testTimeout: 180000, // 3 minutes for e2e tests (includes Chrome download)
    hookTimeout: 180000, // 3 minutes for setup hooks (includes tarball installation)
  },
});
