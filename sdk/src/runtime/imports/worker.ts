import memoize from "lodash/memoize";
import { getRequestInfo, requestInfo } from "../requestInfo/worker";
import { ssrWebpackRequire as baseSsrWebpackRequire } from "rwsdk/__ssr_bridge";
import { findStylesheetsForEntryPoint } from "../../vite/stylesheetDiscovery.mjs";
import { devServer } from "../../vite/devServer.mjs";

export const loadServerModule = memoize(async (id: string) => {
  const { useServerLookup } = await import(
    "virtual:use-server-lookup.js" as string
  );

  const moduleFn = useServerLookup[id];

  if (!moduleFn) {
    throw new Error(
      `(worker) No module found for '${id}' in module lookup for "use server" directive`,
    );
  }

  return await moduleFn();
});

export const getServerModuleExport = async (id: string) => {
  const [file, name] = id.split("#");
  const module = await loadServerModule(file);
  return module[name];
};

export const ssrWebpackRequire = memoize(async (id: string) => {
  if (import.meta.env.DEV && devServer) {
    const projectRootDir = process.cwd();

    const stylesheets = await findStylesheetsForEntryPoint(
      id,
      projectRootDir,
      devServer,
    );

    const {
      rw: { discoveredStyleSheets },
    } = getRequestInfo();

    for (const stylesheet of stylesheets) {
      discoveredStyleSheets.add(stylesheet);
    }
  }

  if (!requestInfo.rw.ssr) {
    return { [id]: () => null };
  }

  return baseSsrWebpackRequire(id);
});
