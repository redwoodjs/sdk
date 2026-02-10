import { defineConfig } from "vite";
import { redwood } from "rwsdk/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [
    tailwindcss(),
    cloudflare({
      viteEnvironment: { name: "worker" },
    }),
    redwood(),
  ],
  environments: {
    ssr: {},
  },
});
