import { cloudflare } from "@cloudflare/vite-plugin";
import { redwood } from "rwsdk/vite";
import { defineConfig } from "vite";
import lightningcss from "vite-plugin-lightningcss";

export default defineConfig({
  plugins: [
    cloudflare({
      viteEnvironment: { name: "worker" },
    }),
    redwood(),
    lightningcss({
      browserslist: "last 2 versions",
    }),
  ],
});
