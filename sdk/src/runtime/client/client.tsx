// note(justinvdm, 14 Aug 2025): Rendering related imports and logic go here.
// See client.tsx for the actual client entrypoint.

// context(justinvdm, 14 Aug 2025): `react-server-dom-webpack` uses this global
// to load modules, so we need to define it here before importing
// "react-server-dom-webpack."
import "./setWebpackRequire";

import React from "react";

import { hydrateRoot } from "react-dom/client";
import {
  createFromReadableStream,
  createFromFetch,
  encodeReply,
} from "react-server-dom-webpack/client.browser";
import { rscStream } from "rsc-html-stream/client";

export { ClientOnly } from "./ClientOnly.js";
export { default as React } from "react";

import type {
  Transport,
  HydrationOptions,
  ActionResponse,
  TransportContext,
} from "./types";

const FLIGHT_DATA_TIMEOUT_MS = 2000; // 2 seconds

/**
 * The RSC payload is streamed into the document after the main client entry
 * script. This creates a race condition where React attempts to hydrate
 * before the necessary `useId` seed has been streamed in. This function
 * provides a way to wait for the first chunk of the RSC stream to arrive
 * before initiating hydration.
 */
async function waitForFlightData(stream: ReadableStream) {
  const reader = stream.getReader();
  let timeoutId: ReturnType<typeof setTimeout>;

  const readPromise = reader.read().then((result) => {
    console.debug(
      "[RSDK] waitForFlightData: stream emitted its first chunk.",
      result,
    );
    // We've verified that the stream has started. Release the lock so the
    // abandoned stream branch can be garbage collected.
    clearTimeout(timeoutId);
    reader.releaseLock();
  });

  const timeoutPromise = new Promise<void>((_resolve, reject) => {
    timeoutId = setTimeout(() => {
      console.warn(
        `[RSDK] waitForFlightData: Timeout triggered. Stream did not emit data within ${FLIGHT_DATA_TIMEOUT_MS}ms.`,
      );
      reader.releaseLock(); // Also release the lock on timeout
      reject(
        new Error(
          `[RSDK] Stream did not receive data within timeout. This could mean the RSC payload was empty or not sent.`,
        ),
      );
    }, FLIGHT_DATA_TIMEOUT_MS);
  });

  return Promise.race([readPromise, timeoutPromise]);
}

export const fetchTransport: Transport = (transportContext) => {
  const fetchCallServer = async <Result,>(
    id: null | string,
    args: null | unknown[],
  ): Promise<Result | undefined> => {
    const url = new URL(window.location.href);
    url.searchParams.set("__rsc", "");

    if (id != null) {
      url.searchParams.set("__rsc_action_id", id);
    }

    const fetchPromise = fetch(url, {
      method: "POST",
      redirect: "manual",
      body: args != null ? await encodeReply(args) : null,
    });

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

export const initClient = async ({
  transport = fetchTransport,
  hydrateRootOptions,
  handleResponse,
}: {
  transport?: Transport;
  hydrateRootOptions?: HydrationOptions;
  handleResponse?: (response: Response) => boolean;
} = {}) => {
  const transportContext: TransportContext = {
    setRscPayload: () => {},
    handleResponse,
  };

  let transportCallServer = transport(transportContext);

  const callServer = (id: any, args: any) => transportCallServer(id, args);

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

  // Tee the stream so we can wait for the first chunk without consuming it for React.
  const [streamForWaiting, streamForReact] = rscStream.tee();

  // Wait for the RSC payload to start streaming in before we hydrate.
  await waitForFlightData(streamForWaiting);

  const rootEl = document.getElementById("hydrate-root");

  if (!rootEl) {
    throw new Error('no element with id "hydrate-root"');
  }

  const rscPayload = createFromReadableStream(streamForReact, {
    callServer,
  });

  function Content() {
    const [streamData, setStreamData] = React.useState(rscPayload);
    const [_isPending, startTransition] = React.useTransition();
    transportContext.setRscPayload = (v) =>
      startTransition(() => setStreamData(v));
    return (
      <>
        {streamData
          ? React.use<{ node: React.ReactNode }>(streamData as any).node
          : null}
      </>
    );
  }

  // By wrapping hydrateRoot in a setTimeout, we yield to the event loop. This
  // gives the RSC stream parser a chance to process the initial payload chunk
  // which may contain the `TreeContext` data needed to seed the `useId`
  // counter. This is the "just right" moment that is early enough to preserve
  // streaming interactivity, but late enough to ensure the client's `useId`
  // counter is correctly seeded.
  setTimeout(() => {
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
  }, 0);

  if (import.meta.hot) {
    import.meta.hot.on("rsc:update", (e: { file: string }) => {
      console.log("[rwsdk] hot update", e.file);
      callServer("__rsc_hot_update", [e.file]);
    });
  }
};
