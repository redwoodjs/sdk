import { Plugin } from "vite";

export const aliasByEnvPlugin = (aliasesByEnv: Record<string, Record<string, string>>): Plugin => ({
  name: "rw-reloaded-env-alias",

  enforce: 'pre',

  resolveId(id, importer) {
    const aliases = aliasesByEnv[this.environment.name] ?? {};
    const alias = aliases[id];
    if (alias) {
      return alias;
    }
  },
});
