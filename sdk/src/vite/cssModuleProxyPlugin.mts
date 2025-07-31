import { type Plugin } from "vite";

export const cssModuleProxyPlugin = (): Plugin => {
  return {
    name: "rwsdk:css-module-proxy",
    enforce: "post",
    async transform(code, id, options) {
      if (this.environment.name !== "worker") {
        return;
      }

      if (!id.endsWith(".module.css") || options?.ssr === false) {
        return;
      }

      const defaultExport = code.match(/^export default (.*);$/m);

      if (!defaultExport) {
        return;
      }

      const originalStyles = defaultExport[1];

      const newCode = `
        import { requestInfo } from "rwsdk/worker";
        const originalStyles = ${originalStyles};
        const moduleId = "${id}";

        export default new Proxy(originalStyles, {
          get(target, prop, receiver) {
            if (requestInfo.rw) {
              requestInfo.rw.usedCssModules.add(moduleId);
            }
            return Reflect.get(target, prop, receiver);
          }
        });
      `;

      return {
        code: newCode,
        map: { mappings: "" },
      };
    },
  };
};
