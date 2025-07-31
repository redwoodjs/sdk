import { type Plugin } from "vite";
import { normalizeModulePath } from "../lib/normalizeModulePath.mjs";

export const cssModuleProxyPlugin = ({
  projectRootDir,
}: {
  projectRootDir: string;
}): Plugin => {
  return {
    name: "rwsdk:css-module-proxy",
    enforce: "post",
    async transform(code, id) {
      if (this.environment.name !== "worker") {
        return;
      }

      if (!id.endsWith(".module.css")) {
        return;
      }

      if (!/export default/.test(code)) {
        return;
      }

      const newCode = `import { requestInfo } from "rwsdk/worker";

function trackStyleCalls(styles, moduleId) {
  return new Proxy(styles, {
    get(target, prop, receiver) {
      if (requestInfo.rw) {
        requestInfo.rw.usedCssModules.add(moduleId);
      }
      return Reflect.get(target, prop, receiver);
    }
  });
}

${code.replace(/export default/g, "const __rwsdk_styles = ")}

export default trackStyleCalls(__rwsdk_styles, "${normalizeModulePath(
        id,
        projectRootDir,
        {
          isViteStyle: false,
        },
      )}");
`;

      return {
        code: newCode,
        map: { mappings: "" },
      };
    },
  };
};
