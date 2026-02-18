import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import mdx from "fumadocs-mdx/vite";
import * as MdxConfig from "./source.config";
import { redwood } from "rwsdk/vite";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      // MDX content still imports from old Starlight packages
      "@astrojs/starlight/components": path.resolve(
        "src/app/components/mdx/index.tsx",
      ),
      "starlight-package-managers": path.resolve(
        "src/app/components/mdx/index.tsx",
      ),
      "astro-embed": path.resolve("src/app/components/mdx/index.tsx"),
      // fumadocs-mdx generated source (rwsdk doesn't use vite-tsconfig-paths)
      "@source": path.resolve(".source"),
      // Prevent fumadocs sidebar auto-scroll on navigation (see scroll-into-view-noop.ts)
      "scroll-into-view-if-needed": path.resolve(
        "src/lib/scroll-into-view-noop.ts",
      ),
    },
  },
  plugins: [
    react({
      babel: {
        plugins: ["babel-plugin-react-compiler"],
      },
    }),
    cloudflare({
      viteEnvironment: { name: "worker" },
    }),
    redwood(),
    tailwindcss(),
    mdx(MdxConfig),
  ],
});
