import MagicString from "magic-string";
import { type Plugin } from "vite";

export const injectHmrPreambleJsxPlugin = (): Plugin => ({
  name: "rw-sdk-inject-hmr-preamble",
  apply: "serve",
  async transform(code: string, id: string) {
    const htmlHeadRE = /jsxDEV\("html",[^]*?jsxDEV\("head",[^]*?\[(.*?)\]/s;

    const match = code.match(htmlHeadRE);

    if (!match) {
      return;
    }

    const s = new MagicString(code);
    const headContentStart = match.index! + match[0].lastIndexOf("[");

    s.appendLeft(
      headContentStart + 1,
      `jsxDEV("script", { 
        type: "module",
        dangerouslySetInnerHTML: { __html: "import RefreshRuntime from '/@react-refresh'; RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => (type) => type; window.__vite_plugin_react_preamble_installed__ = true;" }
      }),`,
    );

    return {
      code: s.toString(),
      map: s.generateMap(),
    };
  },
});
