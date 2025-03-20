import { relative } from "node:path";
import { Plugin } from "vite";
import { parse } from "es-module-lexer";
import MagicString from "magic-string";

export const useServerPlugin = (): Plugin => ({
  name: "rw-sdk-use-server",
  async transform(code, id) {
    if (id.includes(".vite/deps") || id.includes("node_modules")) {
      return;
    }

    const relativeId = `/${relative(this.environment.getTopLevelConfig().root, id)}`;

    if (code.includes('"use server"') || code.includes("'use server'")) {
      // context(justinvdm, 5 Dec 2024): they've served their purpose at this point, keeping them around just causes rollup warnings since module level directives can't easily be applied to bundled
      // modules
      let s = new MagicString(code);
      s.replaceAll("'use server'", "");
      s.replaceAll('"use server"', "");
      s.trim();

      if (this.environment.name === "worker") {
        // TODO: Rewrite the code, but register the "function" against
        s.prepend(`
import { registerServerReference } from "redwoodsdk/worker";
`);
        const [_, exports] = parse(code);

        for (const e of exports) {
          s.append(`
registerServerReference(${e.ln}, ${JSON.stringify(relativeId)}, ${JSON.stringify(e.ln)});
`);
        }
      }
      if (this.environment.name === "client") {
        s = new MagicString(`\
import { createServerReference } from "redwoodsdk/client";
`);
        const [_, exports] = parse(code);
        for (const e of exports) {
          s.append(`\
export const ${e.ln} = createServerReference(${JSON.stringify(relativeId)}, ${JSON.stringify(e.ln)})
`);
        }
      }

      return {
        code: s.toString(),
        map: s.generateMap(),
      };
    }
  },
});
