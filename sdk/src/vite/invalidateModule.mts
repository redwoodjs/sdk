import debug from "debug";
import type { EnvironmentModuleNode, ViteDevServer } from "vite";

const log = debug("rwsdk:vite:invalidate-module");

interface InvalidatableModuleOptions {
  invalidateImportersRecursively?: boolean;
}

export const invalidateModule = (
  devServer: ViteDevServer,
  environment: string,
  target: string | EnvironmentModuleNode,
  options: InvalidatableModuleOptions = {},
  seen: Set<EnvironmentModuleNode> = new Set(),
) => {
  let moduleNode: EnvironmentModuleNode | undefined;
  if (typeof target === "string") {
    const id = target;
    const [rawId, _query] = id.split("?");

    moduleNode =
      devServer?.environments[environment]?.moduleGraph.idToModuleMap.get(
        rawId,
      );
  } else {
    moduleNode = target;
  }

  if (moduleNode) {
    if (seen.has(moduleNode)) {
      return;
    }
    seen.add(moduleNode);

    devServer.environments[environment]?.moduleGraph.invalidateModule(
      moduleNode,
      seen,
    );
    log(
      "Invalidating module: id=%s, environment=%s",
      moduleNode.id,
      environment,
    );

    if (options.invalidateImportersRecursively) {
      for (const importer of moduleNode.importers) {
        invalidateModule(devServer, environment, importer, options, seen);
      }
    }
  } else {
    log(
      "Module not found: id=%s, environment=%s",
      typeof target === "string" ? target : target.id,
      environment,
    );
  }
};
