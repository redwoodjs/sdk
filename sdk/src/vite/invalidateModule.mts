import type { ViteDevServer } from "vite";

export const invalidateModule = (
  devServer: ViteDevServer,
  environment: string,
  id: string,
  log: (message: string, ...args: any[]) => void,
  verboseLog: (message: string, ...args: any[]) => void,
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
