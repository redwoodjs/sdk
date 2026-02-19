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
    redwood({
      // rwsdk's directive scan can't follow import.meta.glob, so fumadocs
      // "use client" modules loaded through MDX content are invisible to it.
      forceClientPaths: [
        "node_modules/fumadocs-ui/dist/**/*.js",
        "node_modules/fumadocs-core/dist/**/*.js",
      ],
    }),
    tailwindcss(),
    mdx(MdxConfig),
  ],
});
