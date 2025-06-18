import React from "react";
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
        `(client) No module found for '${id}' in module lookup for "use client" directive`,
      );
    }

    return await moduleFn();
  }
});

// context(justinvdm, 2 Dec 2024): re memoize(): React relies on the same promise instance being returned for the same id
export const clientWebpackRequire = memoize(async (id: string) => {
  const [file, name] = id.split("#");
  const promisedModule = loadModule(file);
  const promisedComponent = promisedModule.then((module) => module[name]);

  const didSSR = (globalThis as any).__RWSDK_CONTEXT?.rw?.ssr;

  if (didSSR) {
    const awaitedComponent = await promisedComponent;
    return { [id]: awaitedComponent };
  }

  const { ClientOnly } = await import("./ClientOnly");

  const promisedDefault = promisedComponent.then((Component) => ({
    default: Component,
  }));

  const Lazy = React.lazy(() => promisedDefault);

  const Wrapped = () =>
    React.createElement(ClientOnly, null, React.createElement(Lazy));

  return { [id]: Wrapped };
});
