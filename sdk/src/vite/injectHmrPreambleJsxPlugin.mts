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
        src: "/__vite_preamble__",
      }),`,
    );

    return {
      code: s.toString(),
      map: s.generateMap(),
    };
  },
});
