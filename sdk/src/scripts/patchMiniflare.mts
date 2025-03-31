import { createRequire } from "module";
import { resolve as importMetaResolve } from "import-meta-resolve";
import baseDebug from "debug";

// context(justinvdm, 31 Mar 2024): Miniflare always tries to use port 9229 for its inspector,
// which causes issues when running multiple worker scripts concurrently (e.g. during
// parallel postinstall runs in our monorepo). We patch Miniflare's constructor to use
// auto-assigned ports (port 0) instead of the hardcoded 9229.
const debug = baseDebug("rwsdk:patch-miniflare");

debug("Resolving @cloudflare/vite-plugin path...");
const vitePluginPath = importMetaResolve(
  "@cloudflare/vite-plugin",
  import.meta.url,
);
debug("Resolved @cloudflare/vite-plugin to: %s", vitePluginPath);

debug("Creating require relative to vite plugin...");
const vitePluginRequire = createRequire(vitePluginPath);

debug("Resolving miniflare path...");
const miniflareModulePath = vitePluginRequire.resolve("miniflare");
debug("Resolved miniflare to: %s", miniflareModulePath);

debug("Loading miniflare module...");
const miniflare = vitePluginRequire("miniflare");

const OriginalMiniflare = miniflare.Miniflare;
debug("Patching Miniflare constructor...");

const originalConstruct = OriginalMiniflare.prototype.constructor;
OriginalMiniflare.prototype.constructor = function (
  options: any,
  ...args: any[]
) {
  debug("Constructor initialized: %s", options);
  if (options?.inspectorPort === 9229 || options?.inspectorPort == null) {
    debug("Replacing inspector port %s with 0", options?.inspectorPort);
    options.inspectorPort = 0;
  }
  return originalConstruct.call(this, options, ...args);
};

debug("Miniflare constructor patched successfully");
