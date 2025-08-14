// context(justinvdm, 14 Aug 2025): This is the entrypoint for the client bundle.
// All render-blocking deps (e.g. react related) should go in hydrateClient.tsx, not here.
// This is so that we can kick off prefetching (e.g of client components) ASAP, and to avoid
// risk of duplicating across the bundles for deps

// note(justinvdm, 14 Aug 2025): Import order here is important. We use this to
// control what gets bundled into the main client bundle, or if it isnt bundled,
// when it gets fetched, and in both cases, the order in which code is evaluated.
// For instance, we need to set the `__webpack_require__` global before importing
// `react-server-dom-webpack/client.browser`.

// @ts-ignore
// context(justinvdm, 14 Aug 2025): We bundle the client lookup in the main client
// bundle so that we can find out client modules to fetch ASAP (no waterfall/round-trip delay)
export { useClientLookup } from "virtual:use-client-lookup.js";
import "./prefetchClientComponents";

// context(justinvdm, 14 Aug 2025): Prefetch the hydration bundle ASAP
import("./hydrateClient");

import { type Transport, type HydrationOptions } from "./types";

export const initClient = async ({
  transport,
  hydrateRootOptions,
  handleResponse,
}: {
  transport?: Transport;
  hydrateRootOptions?: HydrationOptions;
  handleResponse?: (response: Response) => boolean;
} = {}) => {
  const { hydrateClient } = await import("./hydrateClient");
  return hydrateClient({
    transport,
    hydrateRootOptions,
    handleResponse,
  });
};
