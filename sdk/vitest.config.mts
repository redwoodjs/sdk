import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "virtual:use-client-lookup.js": resolve(
        __dirname,
        "src/runtime/imports/__mocks__/use-client-lookup.ts",
      ),
    },
  },
});
