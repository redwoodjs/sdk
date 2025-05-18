import { Plugin } from "vite";
import debug from "debug";
import { transformClientComponents } from "./transformClientComponents.mjs";

export const useClientPlugin = (): Plugin => ({
  name: "rwsdk:use-client",
  async transform(code, id) {
    return transformClientComponents(code, id, {
      environmentName: this.environment?.name ?? "worker",
      topLevelRoot: this.environment?.getTopLevelConfig?.().root,
    });
  },
});
