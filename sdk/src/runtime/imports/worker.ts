import memoize from "lodash/memoize";
import React from "react";
import { ssrWebpackRequire as baseSsrWebpackRequire } from "rwsdk/__ssr_bridge";
import { requestInfo } from "../requestInfo/worker";

export const loadServerModule = memoize(async (id: string) => {
  const { useServerLookup } = await import(
    "virtual:use-server-lookup" as string
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

// context(justinvdm, 2 Dec 2024): re memoize(): React relies on the same promise instance being returned for the same id
export const serverWebpackRequire = memoize(async (id: string) => {
  const [file, name] = id.split("#");
  const module = await loadServerModule(file);
  return { [id]: module[name] };
});

export const ssrWebpackRequire = memoize(async (id: string) => {
  if (!requestInfo.rw.ssr) {
    return {
      [id]: () => React.createElement(React.Suspense, { fallback: null }, null),
    };
  }

  return baseSsrWebpackRequire(id);
});
