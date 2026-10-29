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

type ServerReferenceManifestEntry = {
  id: string;
  chunks: string[];
  name: string;
  async: true;
};

// context(chrsnym, 2026-10-28): React's decodeAction asks a manifest to
// resolve the identifier from its hidden form field. Limit that manifest to
// modules already discovered by RedwoodSDK's "use server" scan.
export const serverReferenceManifest: Record<
  string,
  ServerReferenceManifestEntry
> = new Proxy(
  {},
  {
    get(_target, id) {
      if (typeof id !== "string") {
        return undefined;
      }

      const [file] = id.split("#");
      if (!useServerLookup[file]) {
        return undefined;
      }

      return { id, chunks: [], name: id, async: true };
    },
  },
);

export const ssrWebpackRequire = memoizeOnId(async (id: string) => {
  const [file, name] = id.split("#");
  if (useServerLookup[file]) {
    const module = await loadServerModule(file);
    return { [id]: module[name] };
  }

  if (!requestInfo.rw.ssr) {
    return { [id]: () => null };
  }

  return baseSsrWebpackRequire(id);
});
