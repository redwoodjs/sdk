import { createServerReference as baseCreateServerReference } from "react-server-dom-webpack/client.edge";
import { memoizeOnId } from "../lib/memoizeOnId";
import {
  type CreateServerReferenceOptions,
  type ServerFunctionMethod,
  type ServerFunctionSource,
  normalizeServerFunctionMetadata,
  setServerFunctionMetadata,
} from "../serverFunctionMetadata.js";

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

const ssrCallServer = async (id: string, args: any) => {
  const action = await getServerModuleExport(id);

  if (typeof action !== "function") {
    throw new Error(`Server function ${id} is not a function`);
  }

  return action(...args);
};

export const createServerReference = (
  id: string,
  name: string,
  method?: ServerFunctionMethod,
  source: ServerFunctionSource = "action",
) => {
  const metadata = normalizeServerFunctionMetadata({ method, source });
  id = id + "#" + name;
  const reference = baseCreateServerReference(id, ssrCallServer);
  setServerFunctionMetadata(reference, metadata);
  return reference;
};

export const createRedwoodServerReference = (
  id: string,
  name: string,
  options: CreateServerReferenceOptions = {},
) => {
  const metadata = normalizeServerFunctionMetadata(options);
  return createServerReference(id, name, metadata.method, metadata.source);
};
