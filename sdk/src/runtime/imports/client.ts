import React from "react";
import { ClientOnly } from "../client/client";
import { memoizeOnId } from "../lib/memoizeOnId";

type ModuleExports = Record<string, unknown>;
type ClientLookup = Record<string, () => Promise<ModuleExports>>;

let cachedClientLookup: ClientLookup | null = null;

const loadClientLookup = async (): Promise<ClientLookup> => {
  if (cachedClientLookup) {
    return cachedClientLookup;
  }

  const globalLookup = (globalThis as Record<string, unknown>)
    .__RWSDK_CLIENT_LOOKUP__;

  if (globalLookup) {
    cachedClientLookup = globalLookup as ClientLookup;
    return cachedClientLookup;
  }

  const module = (await import(
    "virtual:use-client-lookup.js" as string
  )) as { useClientLookup: ClientLookup };

  cachedClientLookup = module.useClientLookup;
  return cachedClientLookup;
};

export const setClientLookupForTesting = (lookup: ClientLookup | null) => {
  cachedClientLookup = lookup;
};

export const loadModule = memoizeOnId(async (id: string) => {
  const clientLookup = await loadClientLookup();
  const moduleFn = clientLookup[id];

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
  const promisedComponent = promisedModule.then(
    (module) => module[name] as React.ComponentType<any>,
  );

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
