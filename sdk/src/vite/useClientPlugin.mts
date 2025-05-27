import { Plugin } from "vite";
import { transformClientComponents } from "./transformClientComponents.mjs";

export const useClientPlugin = (): Plugin => ({
  name: "rwsdk:use-client",
  async transform(code, id) {
    const result = await transformClientComponents(code, id, {
      environmentName: this.environment?.name ?? "worker",
    });

    if (result) {
      return {
        code: result.toString(),
        map: result.generateMap({ hires: true }),
      };
    }
  },
});
