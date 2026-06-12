import { memoizeOnId } from "../lib/memoizeOnId";
import { getLookupCandidates } from "./lookupCandidates";

export const ssrLoadModule = memoizeOnId(async (id: string) => {
  const { useClientLookup } = await import(
    "virtual:use-client-lookup.js" as string
  );
  const moduleFn = getLookupCandidates(id)
    .map((candidate) => useClientLookup[candidate])
    .find(Boolean);

  if (!moduleFn) {
    throw new Error(
      `(ssr) No module found for '${id}' in module lookup for "use client" directive`,
    );
  }

  return await moduleFn();
});
export const ssrGetModuleExport = async (id: string) => {
  const [file, name] = id.split("#");
  const module = await ssrLoadModule(file);
  return name ? module[name] : module;
};

// context(justinvdm, 2 Dec 2024): re memoize(): React relies on the same promise instance being returned for the same id
export const ssrWebpackRequire = memoizeOnId(async (id: string) => {
  const [file, name] = id.split("#");
  const module = await ssrLoadModule(file);

  if (!name) {
    return module;
  }

  return { [id]: module[name] };
});
