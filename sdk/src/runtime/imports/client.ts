import React from "react";
import { ClientOnly } from "../client/client";
import { memoizeOnId } from "../lib/memoizeOnId";

// @ts-ignore
import { useClientLookup } from "virtual:use-client-lookup.js";

export const loadModule = memoizeOnId(async (id: string) => {
  const moduleFn = useClientLookup[id];

  if (!moduleFn) {
    throw new Error(
      `(client) No module found for '${id}' in module lookup for "use client" directive`,
    );
  }

  return await moduleFn();
});

// context(justinvdm, 2 Dec 2024): re memoize(): React relies on the same promise instance being returned for the same id
export const clientWebpackRequire = memoizeOnId(async (id: string) => {
  const [file, name] = id.split("#");
  const promisedModule = loadModule(file);
  const promisedComponent = promisedModule.then((module) => module[name]);

  const didSSR = (globalThis as any).__RWSDK_CONTEXT?.rw?.ssr;

  if (didSSR) {
    const awaitedComponent = await promisedComponent;
    return { [id]: awaitedComponent };
  }
  const promisedDefault = promisedComponent.then((Component) => ({
    default: Component,
  }));

  const Lazy = React.lazy(() => promisedDefault);

  const Wrapped = (props: any) =>
    React.createElement(ClientOnly, null, React.createElement(Lazy, props));

  return { [id]: Wrapped };
});
