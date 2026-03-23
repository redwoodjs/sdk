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
      // rwsdk doesn't use vite-tsconfig-paths, so mirror tsconfig paths here
      "@/": path.resolve("src") + "/",
      "@source": path.resolve(".source"),
      // Stub unused optional peer deps of fumadocs so rwsdk's client barrel
      // doesn't crash when it encounters them at runtime.
      flexsearch: path.resolve("src/lib/module-stub.ts"),
      "@takumi-rs/image-response": path.resolve("src/lib/module-stub.ts"),
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
      // directive scan has run. forceClientPaths pre-registers these modules in
      // the vendor barrel so they're available when discovered during reloads.
      forceClientPaths: [
        "node_modules/fumadocs-ui/dist/**/!(og|next|waku|react-router|tanstack|mdx|*.server).js",
        "node_modules/fumadocs-core/dist/**/!(next|waku|react-router|tanstack|middleware).js",
      ],
      directiveScanBlocklist: [
        "fumadocs-core/dist/framework",
        "fumadocs-ui/dist/provider",
      ],
    }),
    tailwindcss(),
    mdx(MdxConfig),
  ],
});
