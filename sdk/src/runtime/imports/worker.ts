import { ssrWebpackRequire as baseSsrWebpackRequire } from "rwsdk/__ssr_bridge";
import { memoizeOnId } from "../lib/memoizeOnId";
import { requestInfo } from "../requestInfo/worker";

// @ts-ignore
import { useServerLookup } from "virtual:use-server-lookup.js";

export const loadServerModule = memoizeOnId(async (id: string) => {
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

export const ssrWebpackRequire = memoizeOnId(async (id: string) => {
  if (!requestInfo.rw.ssr) {
    return { [id]: () => null };
  }

  return baseSsrWebpackRequire(id);
});
