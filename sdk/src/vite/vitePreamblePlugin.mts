import MagicString from "magic-string";
import { virtualPlugin } from "./virtualPlugin.mjs";

export const vitePreamblePlugin = () => {
  let base = "/";

  const inner = virtualPlugin("vite-preamble", async () => {
    const refreshPath = base.replace(/\/$/, "") + "/@react-refresh";
    const s = new MagicString(`
import RefreshRuntime from "${refreshPath}"; RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => (type) => type; window.__vite_plugin_react_preamble_installed__ = true;
    `);
    return {
      code: s.toString(),
      map: s.generateMap(),
    };
  });

  return {
    ...inner,
    configResolved(config) {
      base = config.base || "/";
    },
  };
};
