import { clientWebpackRequire } from "./imports/client";
import { type CallServerCallback } from "react-server-dom-webpack/client.browser";

// NOTE: `react-server-dom-webpack` uses this global to load modules,
// so we need to define it here before importing "react-server-dom-webpack."
globalThis.__webpack_require__ = clientWebpackRequire;

export const initClient = async () => {
  const callServer: CallServerCallback = async (id, args) => {
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
      { callServer: globalThis.__rsc_callServer },
    );

    setRscPayload(streamData);
    const result = await streamData;
    return (result as { actionResult: unknown }).actionResult;
  };

  globalThis.__rsc_callServer = callServer;

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

  let setRscPayload: (v: Promise<unknown>) => void = () => {};

  function Content() {
    const [streamData, setStreamData] = React.useState(rscPayload);
    const [_isPending, startTransition] = React.useTransition();
    setRscPayload = (v) => startTransition(() => setStreamData(v));
    return <>{React.use<{ node: React.ReactNode }>(streamData).node}</>;
  }

  hydrateRoot(rootEl, <Content />);

  if (import.meta.hot) {
    import.meta.hot.on("rsc:update", (e) => {
      console.log("[rw-sdk] hot update", e.file);
      callServer(null, null);
    });
  }

  return {
    setRscPayload,
  };
};
