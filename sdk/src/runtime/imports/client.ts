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
