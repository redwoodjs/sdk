import { Plugin } from "vite";
import { transformServerReferences } from "./transformServerReferences.mjs";

export const useServerPlugin = (): Plugin => ({
  name: "rwsdk:use-server",
  async transform(code, id) {
    if (id.includes(".vite/deps") || id.includes("node_modules")) {
      return;
    }
    return transformServerReferences(code, id, {
      environmentName: this.environment?.name ?? "worker",
      topLevelRoot: this.environment?.getTopLevelConfig?.().root,
    });
  },
});
