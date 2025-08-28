import { memoizeOnId } from "../lib/memoizeOnId";

export const ssrLoadModule = memoizeOnId(async (id: string) => {
  if (import.meta.env.VITE_IS_DEV_SERVER) {
    const result = await import(id);
    console.log("##########33 result", result);
    return result;
  }

  const { useClientLookup } = await import(
    "virtual:use-client-lookup.js" as string
  );

  const moduleFn = useClientLookup[id];

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
  return module[name];
};

// context(justinvdm, 2 Dec 2024): re memoize(): React relies on the same promise instance being returned for the same id
export const ssrWebpackRequire = memoizeOnId(async (id: string) => {
  const [file, name] = id.split("#");
  const module = await ssrLoadModule(file);
  return { [id]: module[name] };
});
