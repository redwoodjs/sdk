import { createRequire } from "module";
import { resolve as importMetaResolve } from "import-meta-resolve";

// context(justinvdm, 31 Mar 2024): Miniflare always tries to use port 9229 for its inspector,
// which causes issues when running multiple worker scripts concurrently (e.g. during
// parallel postinstall runs in our monorepo). We patch Miniflare's constructor to use
// auto-assigned ports (port 0) instead of the hardcoded 9229.
const require = createRequire(import.meta.url);

const vitePluginPath = importMetaResolve(
  "@cloudflare/vite-plugin",
  import.meta.url,
);
const miniflareModule = importMetaResolve("miniflare", vitePluginPath);
const miniflare = require(miniflareModule);

const OriginalMiniflare = miniflare.Miniflare;

miniflare.Miniflare = function (options: any, ...args: any[]) {
  if (options?.inspectorPort === 9229 || options?.inspectorPort == null) {
    options.inspectorPort = 0;
  }
  return new OriginalMiniflare(options, ...args);
} as typeof OriginalMiniflare;

Object.setPrototypeOf(miniflare.Miniflare, OriginalMiniflare);
miniflare.Miniflare.prototype = OriginalMiniflare.prototype;
