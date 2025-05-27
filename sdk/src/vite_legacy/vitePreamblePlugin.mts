import MagicString from "magic-string";
import { virtualPlugin } from "./virtualPlugin.mjs";

export const vitePreamblePlugin = () =>
  virtualPlugin("vite-preamble", async () => {
    const s = new MagicString(`
import RefreshRuntime from "/@react-refresh"; RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => (type) => type; window.__vite_plugin_react_preamble_installed__ = true;
    `);
    return {
      code: s.toString(),
      map: s.generateMap(),
    };
  });
