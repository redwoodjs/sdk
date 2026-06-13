import { createServerReference as baseCreateServerReference } from "react-server-dom-webpack/client.browser";
import {
  type CreateServerReferenceOptions,
  type ServerFunctionMethod,
  type ServerFunctionSource,
  normalizeServerFunctionMetadata,
  setServerFunctionMetadata,
} from "../serverFunctionMetadata.js";

export const createServerReference = (
  id: string,
  name: string,
  method?: ServerFunctionMethod,
  source: ServerFunctionSource = "action",
) => {
  const metadata = normalizeServerFunctionMetadata({ method, source });
  const fullId = id + "#" + name;
  const proxy = baseCreateServerReference(fullId, (id, args) => {
    return globalThis.__rsc_callServer(
      id,
      args,
      metadata.source,
      metadata.method,
    );
  });

  // Attach metadata that hooks like useQuery can use.
  (proxy as any).id = fullId;
  setServerFunctionMetadata(proxy as Function, metadata);

  return proxy;
};

export const createRedwoodServerReference = (
  id: string,
  name: string,
  options: CreateServerReferenceOptions = {},
) => {
  const metadata = normalizeServerFunctionMetadata(options);
  return createServerReference(id, name, metadata.method, metadata.source);
};
