import { defineConfig } from "vite";
import { rwsdk } from "@redwoodjs/sdk/vite";
import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  plugins: [
    cloudflare({
      viteEnvironment: { name: "worker" },
    }),
    rwsdk(),
  ],
});
