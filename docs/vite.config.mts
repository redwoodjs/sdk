import { cloudflare } from "@cloudflare/vite-plugin";
import contentCollections from "@content-collections/vite";
import tailwindcss from "@tailwindcss/vite";
import mdx from "@mdx-js/rollup";
import remarkFrontmatter from "remark-frontmatter";
import remarkMdxFrontmatter from "remark-mdx-frontmatter";
import { redwood } from "rwsdk/vite";
import { defineConfig } from "vite";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@astrojs/starlight/components": path.resolve(
        "src/app/components/mdx/index.tsx",
      ),
      "starlight-package-managers": path.resolve(
        "src/app/components/mdx/index.tsx",
      ),
      "astro-embed": path.resolve("src/app/components/mdx/index.tsx"),
    },
  },
  plugins: [
    cloudflare({
      viteEnvironment: { name: "worker" },
    }),
    redwood(),
    tailwindcss(),
    mdx({
      remarkPlugins: [remarkFrontmatter, remarkMdxFrontmatter],
    }),
    contentCollections(),
  ],
});
