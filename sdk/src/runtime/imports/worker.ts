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
    // When SSR is disabled, return a Proxy that handles any property access
    // with a null renderer. React's server.edge calls requireModule(manifest.id)
    // then reads moduleExports[manifest.name]. With the split-format manifest
    // (id=referenceKey, name=exportName), the old placeholder {[id]:()=>null}
    // keyed on the full referenceKey#name string, but React reads by export name.
    // A Proxy avoids this mismatch: every named property returns () => null.
    return new Proxy(
      {},
      {
        get(_target, prop) {
          // Return undefined for then/catch to avoid being treated as a thenable
          if (prop === "then" || prop === "catch" || prop === "finally") {
            return undefined;
          }
          return () => null;
        },
      },
    );
  }

  return baseSsrWebpackRequire(id);
});
