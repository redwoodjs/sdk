import { defineConfig } from "vite";
import { redwood } from "rwsdk/vite";
import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  plugins: [
    cloudflare({
      viteEnvironment: { name: "worker" },
    }),
    redwood({
      // context(justinvdm, 24 Sep 2025): Force Chakra UI files to be
      // treated as client components. These files use non-RSC React APIs
      // (createContext) but are missing the "use client" directive.
      forceClientPaths: [
        "node_modules/@chakra-ui/react/dist/esm/components/code-block/code-block-context.js",
        "node_modules/@chakra-ui/react/dist/esm/components/code-block/code-block-adapter-context.js",
      ],
    }),
  ],
});
