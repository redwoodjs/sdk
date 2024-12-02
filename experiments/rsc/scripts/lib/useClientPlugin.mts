import { Plugin } from "vite";
import { parse } from "es-module-lexer";
import { relative } from "node:path";

export const useClientPlugin = (): Plugin => ({
  name: "rw-reloaded-use-client",
  async transform(code, id) {
    if (id.includes(".vite/deps") || id.includes("node_modules")) {
      return;
    }

    const relativeId = `/${relative(this.environment.getTopLevelConfig().root, id)}`;

    if (code.includes('"use client"') || code.includes("'use client'")) {
      if (this.environment.name === "worker") {
        let newCode = `
import { registerClientReference } from "/src/register/rsc.ts";
`;
        const [_, exports] = parse(code);
        for (const e of exports) {
          newCode += `\
export const ${e.ln} = registerClientReference(${JSON.stringify(relativeId)}, ${JSON.stringify(e.ln)});
`;
        }

        return newCode;
      }
    }
  },
});
