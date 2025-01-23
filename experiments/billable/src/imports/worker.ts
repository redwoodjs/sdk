import memoize from "lodash/memoize";

const modules = (
  import.meta as object as {
    glob: (
      pattern: string,
    ) => Record<string, () => Promise<Record<string, unknown>>>;
  }
).glob("/src/app/**/*.{ts,tsx}");

export const loadModule = memoize(async (moduleName: string) => {
  return await modules[moduleName]()
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
