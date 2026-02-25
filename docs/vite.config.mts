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
      // fumadocs-mdx generates component imports at build time, after rwsdk's
      // directive scan has run. Extglob excludes files that import uninstalled
      // optional peer deps, *.server modules, and mdx (server-side component map).
      forceClientPaths: [
        "node_modules/fumadocs-ui/dist/**/!(og|next|waku|react-router|tanstack|mdx|*.server).js",
        "node_modules/fumadocs-core/dist/**/!(next|waku|react-router|tanstack|middleware).js",
      ],
      // Prevent the directive scan from re-adding framework files that have
      // 'use client' but import uninstalled packages.
      directiveScanBlocklist: [
        "fumadocs-core/dist/framework",
        "fumadocs-ui/dist/provider",
      ],
    }),
    tailwindcss(),
    mdx(MdxConfig),
  ],
});
