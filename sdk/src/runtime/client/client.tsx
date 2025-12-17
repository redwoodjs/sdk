// note(justinvdm, 14 Aug 2025): Rendering related imports and logic go here.
// See client.tsx for the actual client entrypoint.

// context(justinvdm, 14 Aug 2025): `react-server-dom-webpack` uses this global
// to load modules, so we need to define it here before importing
// "react-server-dom-webpack."
// prettier-ignore
import "./setWebpackRequire";

import React from "react";

import { hydrateRoot } from "react-dom/client";
import {
  createFromFetch,
  createFromReadableStream,
  encodeReply,
} from "react-server-dom-webpack/client.browser";
import { rscStream } from "rsc-html-stream/client";

export { default as React } from "react";
export type { Dispatch, MutableRefObject, SetStateAction } from "react";
export { ClientOnly } from "./ClientOnly.js";
export { initClientNavigation, navigate } from "./navigation.js";

import { getCachedNavigationResponse } from "./navigationCache.js";

import type {
  ActionResponse,
  HydrationOptions,
  Transport,
  TransportContext,
} from "./types";

export const fetchTransport: Transport = (transportContext) => {
  const fetchCallServer = async <Result,>(
    id: null | string,
    args: null | unknown[],
    source: "action" | "navigation" = "action",
  ): Promise<Result | undefined> => {
    const url = new URL(window.location.href);
    url.searchParams.set("__rsc", "");

    const isAction = id != null;

    if (isAction) {
      url.searchParams.set("__rsc_action_id", id);
    }

    let fetchPromise: Promise<Response>;

    if (!isAction && source === "navigation") {
      // Try to get cached response first
      const cachedResponse = await getCachedNavigationResponse(url);
      if (cachedResponse) {
        fetchPromise = Promise.resolve(cachedResponse);
      } else {
        // Fall back to network fetch on cache miss
        fetchPromise = fetch(url, {
          method: "GET",
          redirect: "manual",
        });
      }
    } else {
      fetchPromise = fetch(url, {
        method: "POST",
        redirect: "manual",
        body: args != null ? await encodeReply(args) : null,
      });
    }

    // If there's a response handler, check the response first
    if (transportContext.handleResponse) {
      const response = await fetchPromise;
      const shouldContinue = transportContext.handleResponse(response);
      if (!shouldContinue) {
        return;
      }

      // Continue with the response if handler returned true
      const streamData = createFromFetch(Promise.resolve(response), {
        callServer: fetchCallServer,
      }) as Promise<ActionResponse<Result>>;

      transportContext.setRscPayload(streamData);
      const result = await streamData;
      return (result as { actionResult: Result }).actionResult;
    }

    // Original behavior when no handler is present
    const streamData = createFromFetch(fetchPromise, {
      callServer: fetchCallServer,
    }) as Promise<ActionResponse<Result>>;

    transportContext.setRscPayload(streamData);
    const result = await streamData;
    return (result as { actionResult: Result }).actionResult;
  };

  return fetchCallServer;
};

/**
 * Initializes the React client and hydrates the RSC payload.
 *
 * This function sets up client-side hydration for React Server Components,
 * making the page interactive. Call this from your client entry point.
 *
 * @param transport - Custom transport for server communication (defaults to fetchTransport)
 * @param hydrateRootOptions - Options passed to React's hydrateRoot
 * @param handleResponse - Custom response handler for navigation errors
 *
 * @example
 * // Basic usage
 * import { initClient } from "rwsdk/client";
 *
 * initClient();
 *
 * @example
 * // With client-side navigation
 * import { initClient, initClientNavigation } from "rwsdk/client";
 *
 * const { handleResponse } = initClientNavigation();
 * initClient({ handleResponse });
 *
 * @example
 * // With custom React hydration options
 * initClient({
 *   hydrateRootOptions: {
 *     onRecoverableError: (error) => {
 *       console.warn("Recoverable error:", error);
 *     },
 *   },
 * });
 */
export const initClient = async ({
  transport = fetchTransport,
  hydrateRootOptions,
  handleResponse,
  onHydrationUpdate,
}: {
  transport?: Transport;
  hydrateRootOptions?: HydrationOptions;
  handleResponse?: (response: Response) => boolean;
  onHydrationUpdate?: () => void;
} = {}) => {
  const transportContext: TransportContext = {
    setRscPayload: () => {},
    handleResponse,
    onHydrationUpdate,
  };

  let transportCallServer = transport(transportContext);

  const callServer = (id: any, args: any, source?: "action" | "navigation") => {
    return transportCallServer(id, args, source);
  };

  const upgradeToRealtime = async ({ key }: { key?: string } = {}) => {
    const { realtimeTransport } = await import("../lib/realtime/client");
    const createRealtimeTransport = realtimeTransport({ key });
    transportCallServer = createRealtimeTransport(transportContext);
  };

  globalThis.__rsc_callServer = callServer;

  globalThis.__rw = {
    callServer,
    upgradeToRealtime,
  };

  const rootEl = document.getElementById("hydrate-root");

  if (!rootEl) {
    throw new Error('no element with id "hydrate-root"');
  }

  let rscPayload: any;

  // context(justinvdm, 18 Jun 2025): We inject the RSC payload
  // unless render(Document, [...], { rscPayload: false }) was used.
  if ((globalThis as any).__FLIGHT_DATA) {
    rscPayload = createFromReadableStream(rscStream, {
      callServer,
    });
  }

  function Content() {
    const [streamData, setStreamData] = React.useState(rscPayload);
    const [_isPending, startTransition] = React.useTransition();
    transportContext.setRscPayload = (v) =>
      startTransition(() => {
        setStreamData(v);
      });

    React.useEffect(() => {
      if (!streamData) return;
      transportContext.onHydrationUpdate?.();
    }, [streamData]);
    return (
      <>
        {streamData
          ? React.use<{ node: React.ReactNode }>(streamData).node
          : null}
      </>
    );
  }

  hydrateRoot(rootEl, <Content />, {
    onUncaughtError: (error, { componentStack }) => {
      console.error(
        "Uncaught error: %O\n\nComponent stack:%s",
        error,
        componentStack,
      );
    },

    ...hydrateRootOptions,
  });

  if (import.meta.hot) {
    import.meta.hot.on("rsc:update", (e: { file: string }) => {
      console.log("[rwsdk] hot update", e.file);
      callServer("__rsc_hot_update", [e.file]);
    });
  }
};
