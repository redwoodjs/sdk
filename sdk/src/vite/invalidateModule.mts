import debug from "debug";
import type { ViteDevServer } from "vite";

const log = debug("rwsdk:vite:invalidate-module");
const verboseLog = debug("verbose:rwsdk:vite:invalidate-module");

export const invalidateModule = (
  devServer: ViteDevServer,
  environment: string,
  id: string,
) => {
  const [rawId, _query] = id.split("?");
  log("Invalidating module: id=%s, environment=%s", id, environment);

  const moduleNode =
    devServer?.environments[environment]?.moduleGraph.idToModuleMap.get(rawId);

  if (moduleNode) {
    devServer?.environments[environment]?.moduleGraph.invalidateModule(
      moduleNode,
    );
  } else {
    verboseLog("Module not found: id=%s, environment=%s", id, environment);
  }
};
