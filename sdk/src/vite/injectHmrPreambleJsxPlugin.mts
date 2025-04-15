import MagicString from "magic-string";
import { type Plugin } from "vite";

export const injectHmrPreambleJsxPlugin = (): Plugin => ({
  name: "rw-sdk-inject-hmr-preamble",
  apply: "serve",
  async transform(code: string, id: string) {
    const htmlHeadRE = /jsxDEV\("html",[^]*?jsxDEV\("head",[^]*?\[(.*?)\]/s;

    const htmlMatch = code.match(htmlHeadRE);

    if (!htmlMatch) {
      return;
    }

    const s = new MagicString(code);
    const headContentStart = htmlMatch.index! + htmlMatch[0].lastIndexOf("[");

    const scriptRegex =
      /jsxDEV\("script",\s*{\s*dangerouslySetInnerHTML:\s*{\s*__html:\s*['"](.+?)['"]\s*}\s*}\)/g;
    const fileContent = s.toString();

    let scriptMatch: RegExpExecArray | null;
    while ((scriptMatch = scriptRegex.exec(fileContent)) !== null) {
      const scriptContent = scriptMatch[1];
      const matchIndex = scriptMatch.index;
      const fullMatch = scriptMatch[0];

      if (scriptContent.includes('import("./src/client.tsx")')) {
        s.overwrite(
          matchIndex + fullMatch.indexOf("__html: ") + 8,
          matchIndex +
            fullMatch.indexOf("__html: ") +
            8 +
            scriptContent.length +
            2,
          `'import("/__vite_preamble__").then(() => ${scriptContent})'`
        );
      }
    }

    return {
      code: s.toString(),
      map: s.generateMap(),
    };
  },
});
