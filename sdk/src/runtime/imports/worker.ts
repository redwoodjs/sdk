import memoize from "lodash/memoize";

export const loadModule = memoize(async (id: string) => {
  if (import.meta.env.DEV && !process.env.PREVIEW) {
    return await import(/* @vite-ignore */ id);
  } else {
    const { useClientLookup } = await import(
      "virtual:use-client-lookup" as string
    );

    const moduleFn = useClientLookup[id];

    if (!moduleFn) {
      throw new Error(
        `No module found for '${id}' in module lookup for "use client" directive`,
      );
    }

    return await moduleFn();
  }
});

export const getModuleExport = async (id: string) => {
  const [file, name] = id.split("#");
  const module = await loadModule(file);
  return module[name];
};

// context(justinvdm, 2 Dec 2024): re memoize(): React relies on the same promise instance being returned for the same id
export const ssrWebpackRequire = memoize(async (id: string) => {
  const [file, name] = id.split("#");
  const module = await loadModule(file);
  return { [id]: module[name] };
});
