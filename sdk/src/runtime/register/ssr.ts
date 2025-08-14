import memoize from "micro-memoize";
import { createServerReference as baseCreateServerReference } from "react-server-dom-webpack/client.edge";

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

const ssrCallServer = async (id: string, args: any) => {
  const action = await getServerModuleExport(id);

  if (typeof action !== "function") {
    throw new Error(`Server function ${id} is not a function`);
  }

  return action(...args);
};

export const createServerReference = (id: string, name: string) => {
  id = id + "#" + name;
  return baseCreateServerReference(id, ssrCallServer);
};
