import memoize from "lodash/memoize";

const SSR_NAMESPACE_PREFIX = "virtual:rwsdk:ssr:";

export const loadModule = memoize(async (id: string) => {
  const request = id.startsWith(SSR_NAMESPACE_PREFIX)
    ? id.slice(SSR_NAMESPACE_PREFIX.length)
    : id;

  if (import.meta.env.DEV && !process.env.PREVIEW) {
    return await import(/* @vite-ignore */ request);
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
  console.log(
    "########################## ssrWebpackRequire module ",
    module,
    name,
    module[name],
  );
  return { [id]: module[name] };
});
