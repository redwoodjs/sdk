import { clientWebpackRequire } from "./imports/client";
import { type CallServerCallback } from "react-server-dom-webpack/client.browser";
import { type HydrationOptions } from "react-dom/client";

// NOTE: `react-server-dom-webpack` uses this global to load modules,
// so we need to define it here before importing "react-server-dom-webpack."
globalThis.__webpack_require__ = clientWebpackRequire;

export type ActionResponse<Result> = {
  node: React.ReactNode;
  actionResult: Result;
};

type TransportContext = {
  setRscPayload: <Result>(v: Promise<ActionResponse<Result>>) => void;
};

export type Transport = (context: TransportContext) => CallServerCallback;

export type CreateCallServer = (
  context: TransportContext,
) => <Result>(id: null | string, args: null | unknown[]) => Promise<Result>;

export const fetchTransport: Transport = (transportContext) => {
  const fetchCallServer = async <Result,>(
    id: null | string,
    args: null | unknown[],
  ): Promise<Result> => {
    const { createFromFetch, encodeReply } = await import(
      "react-server-dom-webpack/client.browser"
    );

    const url = new URL(window.location.href);
    url.searchParams.set("__rsc", "");

    if (id != null) {
      url.searchParams.set("__rsc_action_id", id);
    }

    const streamData = createFromFetch(
      fetch(url, {
        method: "POST",
        body: args != null ? await encodeReply(args) : null,
      }),
      { callServer: fetchCallServer },
    ) as Promise<ActionResponse<Result>>;

    transportContext.setRscPayload(streamData);
    const result = await streamData;
    return (result as { actionResult: Result }).actionResult;
  };

  return fetchCallServer;
};

export const initClient = async ({
  transport = fetchTransport,
  hydrateRootOptions,
}: {
  transport?: Transport;
  hydrateRootOptions?: HydrationOptions;
} = {}) => {
  const React = await import("react");
  const { hydrateRoot } = await import("react-dom/client");

  const transportContext: TransportContext = {
    setRscPayload: () => {},
  };

  let transportCallServer = transport(transportContext);

  const callServer = (id: any, args: any) => transportCallServer(id, args);

  const upgradeToRealtime = async ({ key }: { key?: string } = {}) => {
    const { realtimeTransport } = await import("./lib/realtime/client");
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
    const { createFromReadableStream } = await import(
      "react-server-dom-webpack/client.browser"
    );
    const { rscStream } = await import("rsc-html-stream/client");
    rscPayload = createFromReadableStream(rscStream, {
      callServer,
    });
  }

  function Content() {
    const [streamData, setStreamData] = React.useState(rscPayload);
    const [_isPending, startTransition] = React.useTransition();
    transportContext.setRscPayload = (v) =>
      startTransition(() => setStreamData(v));
    return <>{React.use<{ node: React.ReactNode }>(streamData).node}</>;
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
    import.meta.hot.on("rsc:update", (e) => {
      console.log("[rwsdk] hot update", e.file);
      callServer("__rsc_hot_update", [e.file]);
    });
  }
};
