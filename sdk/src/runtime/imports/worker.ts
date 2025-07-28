import memoize from "lodash/memoize";
import { getRequestInfo } from "../requestInfo/worker";
import { ssrWebpackRequire as baseSsrWebpackRequire } from "rwsdk/__ssr_bridge";
import { findStylesheetsForEntryPoint } from "../../vite/stylesheetDiscovery.mjs";

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
  const requestInfo = getRequestInfo();

  if (!requestInfo.rw.ssr) {
    return { [id]: () => null };
  }

  const discoveredStyles = await findStylesheetsForEntryPoint(
    id,
    requestInfo.rw.projectRootDir,
    requestInfo.rw.viteDevServer,
  );

  for (const style of discoveredStyles) {
    requestInfo.rw.discoveredStyleSheets.add(style);
  }

  return baseSsrWebpackRequire(id);
});
