import { Plugin } from "vite";
import { transformServerReferences } from "./transformServerReferences.mjs";

export const useServerPlugin = (): Plugin => ({
  name: "rwsdk:use-server",
  async transform(code, id) {
    return transformServerReferences(code, id, {
      environmentName: this.environment?.name ?? "worker",
      topLevelRoot: this.environment?.getTopLevelConfig?.().root,
    });
  },
});
