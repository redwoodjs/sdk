import memoize from "lodash/memoize";

export const ssrLoadModule = memoize(async (id: string) => {
  const { useClientLookup } = await import(
    "virtual:use-client-lookup" as string
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
export const ssrWebpackRequire = memoize(async (id: string) => {
  const [file, name] = id.split("#");
  const module = await ssrLoadModule(file);
  return { [id]: module[name] };
});
