import { MiniflareOptions } from "miniflare";
import { dotenv } from "../lib/dotenv.mjs";

export const miniflareConfig: Partial<MiniflareOptions> = {
  modules: true,
  bindings: dotenv,
};
