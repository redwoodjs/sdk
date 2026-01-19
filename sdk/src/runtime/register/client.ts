import { createServerReference as baseCreateServerReference } from "react-server-dom-webpack/client.browser";

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

  // Attach metadata that hooks like useQuery can use
  (proxy as any).id = fullId;
  (proxy as any).method = method;
  (proxy as any).source = source;

  return proxy;
};
