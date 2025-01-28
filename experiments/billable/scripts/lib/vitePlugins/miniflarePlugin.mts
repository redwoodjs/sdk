import { Plugin } from "vite";
import { cloudflare } from "@cloudflare/vite-plugin";

type BasePluginOptions = Parameters<typeof cloudflare>[0];

type MiniflarePluginOptions = BasePluginOptions & {
}

export const miniflarePlugin = (
  givenOptions: MiniflarePluginOptions,
): Plugin => cloudflare(givenOptions);