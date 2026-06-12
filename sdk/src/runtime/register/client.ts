import { createServerReference as baseCreateServerReference } from "react-server-dom-webpack/client.browser";
import { setServerFunctionMetadata } from "../serverFunctionMetadata.js";

export const createServerReference = (
  id: string,
  name: string,
  method?: "GET" | "POST",
  source: "action" | "query" = "action",
) => {
  const fullId = id + "#" + name;
  const proxy = baseCreateServerReference(fullId, (id, args) => {
    return globalThis.__rsc_callServer(id, args, source, method);
  });

  // Attach metadata that hooks like useQuery can use.
  (proxy as any).id = fullId;
  setServerFunctionMetadata(proxy as Function, {
    method: method ?? "POST",
    source,
  });

  return proxy;
};

export const createRedwoodServerReference = (
  id: string,
  name: string,
  options: {
    method?: "GET" | "POST";
    source?: "action" | "query";
  } = {},
) => {
  return createServerReference(id, name, options.method, options.source ?? "action");
};
