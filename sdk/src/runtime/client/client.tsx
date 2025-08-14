// imports to include in the client bundle

import {
  React,
  hydrateRoot,
  createFromReadableStream,
  rscStream,
} from "./renderBlockers";

import { parseFlightData } from "./parseFlightData";

import { CallServerCallback, HydrationOptions } from "./types";

export type ActionResponse<Result> = {
  node: React.ReactNode;
  actionResult: Result;
};

type TransportContext = {
  setRscPayload: <Result>(v: Promise<ActionResponse<Result>>) => void;
  handleResponse?: (response: Response) => boolean; // Returns false to stop normal processing
};

export type Transport = (context: TransportContext) => CallServerCallback;

export type CreateCallServer = (
  context: TransportContext,
) => <Result>(id: null | string, args: null | unknown[]) => Promise<Result>;

export const fetchTransport: Transport = (transportContext) => {
  const fetchCallServer = async <Result,>(
    id: null | string,
    args: null | unknown[],
  ): Promise<Result | undefined> => {
    const { createFromFetch, encodeReply } = await import(
      "./interactivityBlockers"
    );

    const url = new URL(window.location.href);
    url.searchParams.set("__rsc", "");

    if (id != null) {
      url.searchParams.set("__rsc_action_id", id);
    }

    const fetchPromise = fetch(url, {
      method: "POST",
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
    const clientComponents = parseFlightData((globalThis as any).__FLIGHT_DATA);
    console.log("Client Components:", clientComponents);
  }

  function Content() {
    const [streamData, setStreamData] = React.useState(rscPayload);
    const [_isPending, startTransition] = React.useTransition();
    transportContext.setRscPayload = (v) =>
      startTransition(() => setStreamData(v));
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
