export type ServerFunctionSource = "action" | "query";
export type ServerFunctionMethod = "GET" | "POST";

export type ServerFunctionMetadata = {
  method: ServerFunctionMethod;
  source: ServerFunctionSource;
};

export type CreateServerReferenceOptions = Partial<ServerFunctionMetadata>;

export const normalizeServerFunctionMetadata = ({
  method = "POST",
  source = "action",
}: CreateServerReferenceOptions = {}): ServerFunctionMetadata => ({
  method,
  source,
});

type ServerFunctionWithMetadata = Function & {
  method?: ServerFunctionMethod;
  source?: ServerFunctionSource;
  __rw_server_function?: ServerFunctionMetadata;
};

const metadataKey = "__rw_server_function";

export function setServerFunctionMetadata<T extends Function>(
  fn: T,
  metadata: ServerFunctionMetadata,
): T {
  const target = fn as T & ServerFunctionWithMetadata;

  Object.defineProperty(target, metadataKey, {
    value: metadata,
    configurable: true,
  });

  // Keep the historical properties for compatibility with existing runtime
  // checks and generated code. The private metadata object is the canonical
  // shape for new adapters.
  target.method = metadata.method;
  target.source = metadata.source;

  return fn;
}

export function getServerFunctionMetadata(
  fn: unknown,
): ServerFunctionMetadata | undefined {
  if (typeof fn !== "function") {
    return undefined;
  }

  const target = fn as ServerFunctionWithMetadata;
  const metadata = target[metadataKey];
  if (metadata) {
    return metadata;
  }

  if (target.method === "GET" || target.method === "POST") {
    return {
      method: target.method,
      source: target.source ?? "action",
    };
  }

  return undefined;
}

