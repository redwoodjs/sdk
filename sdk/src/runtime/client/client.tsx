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

declare global {
  var __FLIGHT_DATA__: any[] | undefined;
}

const FLIGHT_DATA_TIMEOUT_MS = 2000; // 2 seconds
const FLIGHT_DATA_POLL_INTERVAL_MS = 10;

async function waitForFlightData() {
  let reader: ReadableStreamDefaultReader<any> | undefined;
  let timeoutId: ReturnType<typeof setTimeout>;

  try {
    reader = rscStream.getReader();

    const dataPromise = reader.read();

    const timeoutPromise = new Promise<void>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(
          new Error(
            "[RSDK] __FLIGHT_DATA__ did not receive data within timeout.",
          ),
        );
      }, FLIGHT_DATA_TIMEOUT_MS);
    });

    await Promise.race([dataPromise, timeoutPromise]);
  } catch (error) {
    console.warn(error instanceof Error ? error.message : String(error));
  } finally {
    if (reader) {
      reader.releaseLock();
    }
    clearTimeout(timeoutId!);
  }
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

  self.__rsc_callServer = callServer;

  self.__rw = {
    callServer,
    upgradeToRealtime,
  };

  // Wait for __FLIGHT_DATA__ to be populated by server scripts
  await waitForFlightData();

  const rootEl = document.getElementById("hydrate-root");

  if (!rootEl) {
    throw new Error('no element with id "hydrate-root"');
  }

  const rscPayload = createFromReadableStream(rscStream, {
    callServer,
  });

  // New component to consume the RSC stream, wrapped in Suspense
  function RscStreamContent({ rscPayload }: { rscPayload: any }) {
    const rscResponse = React.use(rscPayload);
    return (rscResponse as any).node as Awaited<React.ReactNode>;
  }

  // The main App component passed to hydrateRoot, which renders existing children
  // and then the RSC content within a Suspense boundary.
  function App() {
    return (
      <React.Suspense fallback={<></>}>
        <RscStreamContent rscPayload={rscPayload} />
      </React.Suspense>
    );
  }

  hydrateRoot(rootEl, <App />, {
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
