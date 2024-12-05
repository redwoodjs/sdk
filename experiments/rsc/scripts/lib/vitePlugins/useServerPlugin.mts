import { relative } from "node:path";
import { Plugin } from "vite";
import { parse } from "es-module-lexer";
import MagicString from "magic-string";

export const useServerPlugin = (): Plugin => ({
  name: "rw-reloaded-use-server",
  async transform(code, id) {
    if (id.includes(".vite/deps") || id.includes("node_modules")) {
      return;
    }

    const relativeId = `/${relative(this.environment.getTopLevelConfig().root, id)}`;

    if (code.includes('"use server"') || code.includes("'use server'")) {
      if (this.environment.name === "worker") {
        // TODO: Rewrite the code, but register the "function" against
        const s = new MagicString(code);

        s.prepend(`\
import { registerServerReference } from "/src/register/worker.ts";
`);
        const [_, exports] = parse(code);

        for (const e of exports) {
          s.append(`\
registerServerReference(${e.ln}, ${JSON.stringify(relativeId)}, ${JSON.stringify(e.ln)});
`);
        }

        return {
          code: s.toString(),
          map: s.generateMap(),
        };
      }
      if (this.environment.name === "client") {
        const s = new MagicString(`\
import { createServerReference } from "/src/register/client.ts";
`);
        const [_, exports] = parse(code);
        for (const e of exports) {
          s.append(`\
export const ${e.ln} = createServerReference(${JSON.stringify(relativeId)}, ${JSON.stringify(e.ln)})
`);
        }
        return {
          code: s.toString(),
          map: s.generateMap(),
        };
      }
    }
  },
});
