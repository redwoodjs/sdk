import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["playground/**/*.test.mts"],
  },
});
