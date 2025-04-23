import { clientWebpackRequire } from "./imports/client";
import { type CallServerCallback } from "react-server-dom-webpack/client.browser";

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
  context: TransportContext
) => <Result>(id: null | string, args: null | unknown[]) => Promise<Result>;

export const fetchTransport: Transport = (transportContext) => {
  const fetchCallServer = async <Result,>(
    id: null | string,
    args: null | unknown[]
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
      { callServer: fetchCallServer }
    ) as Promise<ActionResponse<Result>>;

    transportContext.setRscPayload(streamData);
    const result = await streamData;
    return (result as { actionResult: Result }).actionResult;
  };

  return fetchCallServer;
};

// Define health check response type
export const initClient = async ({
  transport = fetchTransport,
}: {
  transport?: Transport;
} = {}) => {
  const transportContext: TransportContext = {
    setRscPayload: () => {},
  };

  const callServer = transport(transportContext);
  globalThis.__rsc_callServer = callServer;

  // Handle health check route
  if (window.location.pathname === "/__health") {
    try {
      // Send the current timestamp to verify round-trip
      const timestamp = Date.now();
      const result = await callServer("__health", [timestamp]);

      let status = "error";
      let verificationPassed = false;

      // Check if we got back the same timestamp
      if (typeof result === "object" && result !== null) {
        const healthResult = result as { status: string; timestamp: number };
        status = healthResult.status || "error";
        verificationPassed = healthResult.timestamp === timestamp;
      } else if (result === "ok") {
        status = "ok";
        // Legacy support for servers that don't echo back timestamps
        verificationPassed = true;
      }

      document.body.innerHTML = `
        <div id="health-check-result" 
             data-result="${status}" 
             data-timestamp="${timestamp}"
             data-verified="${verificationPassed}">
          ${status}: ${
        verificationPassed ? "Verification passed" : "Verification failed"
      }
        </div>`;

      console.log("Health check result:", result);
      console.log(
        "Timestamp verification:",
        verificationPassed ? "Passed" : "Failed"
      );
      return;
    } catch (error: unknown) {
      console.error("Health check failed:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      document.body.innerHTML = `<div id="health-check-result" data-result="error">Error: ${errorMessage}</div>`;
      return;
    }
  }

  const rootEl = document.getElementById("root");

  if (!rootEl) {
    throw new Error('no element with id "root"');
  }

  const React = await import("react");
  const { hydrateRoot } = await import("react-dom/client");
  // @ts-ignore: todo(peterp, 2024-11-27): Type these properly.
  const { createFromReadableStream, createFromFetch, encodeReply } =
    await import("react-server-dom-webpack/client.browser");
  const { rscStream } = await import("rsc-html-stream/client");

  let rscPayload: any;
  rscPayload ??= createFromReadableStream(rscStream, {
    callServer,
  });

  function Content() {
    const [streamData, setStreamData] = React.useState(rscPayload);
    const [_isPending, startTransition] = React.useTransition();
    transportContext.setRscPayload = (v) =>
      startTransition(() => setStreamData(v));
    return <>{React.use<{ node: React.ReactNode }>(streamData).node}</>;
  }

  hydrateRoot(rootEl, <Content />);

  if (import.meta.hot) {
    import.meta.hot.on("rsc:update", (e) => {
      console.log("[rw-sdk] hot update", e.file);
      callServer("__rsc_hot_update", [e.file]);
    });
  }
};
