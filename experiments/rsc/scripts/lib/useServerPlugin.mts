import { Plugin } from "vite";
import { parse } from "es-module-lexer";
import { relative } from "node:path";

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
        let newCode = `
import { registerServerReference } from "/src/register/rsc.ts";
`;
        const [_, exports] = parse(code);
        for (const e of exports) {
          newCode += `\
registerServerReference(${e.ln}, ${JSON.stringify(relativeId)}, ${JSON.stringify(e.ln)});
`;
        }

        return [code, newCode].join("\n");
      }
      if (this.environment.name === "client") {
        let newCode = `\
import { createServerReference } from "/src/register/client.ts";
`;
        const [_, exports] = parse(code);
        for (const e of exports) {
          newCode += `\
export const ${e.ln} = createServerReference(${JSON.stringify(relativeId)}, ${JSON.stringify(e.ln)})
`;
        }
        return newCode;
      }
    }
  },
});
