import { relative } from "node:path";
import { Plugin } from "vite";
import { parse } from "es-module-lexer";
import MagicString from "magic-string";

export const useClientPlugin = (): Plugin => ({
  name: "rw-sdk-use-client",
  async transform(code, id) {
    if (id.includes(".vite/deps") || id.includes("node_modules")) {
      return;
    }

    const relativeId = `/${relative(this.environment.getTopLevelConfig().root, id)}`;
    if (code.includes('"use client"') || code.includes("'use client'")) {
      const s = new MagicString(code);

      // context(justinvdm, 5 Dec 2024): they've served their purpose at this point, keeping them around just causes rollup warnings since module level directives can't easily be applied to bundled
      // modules
      s.replaceAll("'use client'", "// 'use client'");
      s.replaceAll('"use client"', "// 'use client'");
      s.trim();

      if (this.environment.name === "worker") {
        s.prepend(`
import { registerClientReference } from "/src/register/worker.ts";
`);

        const [_, exports] = parse(code);

        for (const e of exports) {
          if (e.ln != null) {
            s.replaceAll(e.ln, `${e.ln}SSR`);

            s.append(`\
export const ${e.ln} = registerClientReference(${JSON.stringify(relativeId)}, ${JSON.stringify(e.ln)});
`);
          }
        }
      }

      return {
        code: s.toString(),
        map: s.generateMap(),
      };
    }
  },
});
