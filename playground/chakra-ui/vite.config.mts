import { defineConfig } from "vite";
import { redwood } from "rwsdk/vite";
import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  plugins: [
    cloudflare({
      viteEnvironment: { name: "worker" },
    }),
    redwood({
      forceClientPaths: [
        "node_modules/@chakra-ui/react/src/components/code-block/code-block-context.ts",
        "node_modules/@chakra-ui/react/src/components/code-block/code-block-adapter-context.ts",
      ],
    }),
  ],
});
