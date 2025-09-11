import { ssrGetModuleExport } from "rwsdk/__ssr_bridge";

export const resolveSSRValue = <Value>(
  clientReference: Value,
): Promise<Value> => {
  const id = (clientReference as any).__rwsdk_clientReferenceId;
  if (!id) {
    throw new Error("RWSDK: Client reference is not a client reference");
  }

  return ssrGetModuleExport(id) as Promise<Value>;
};
