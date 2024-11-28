import { memoize } from "lodash";

async function init() {
  // NOTE: `react-server-dom-webpack` uses this global to load modules,
  // so we need to define it here before importing "react-server-dom-webpack."
  globalThis.__webpack_require__ = memoize(function (id: string) {
    const module = import(/* @vite-ignore */ id);
    return module;
  });

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
  rscPayload ??= createFromReadableStream(rscStream);

  let setRscPayload: (v: Promise<unknown>) => void;

  function Content() {
    const [streamData, setStreamData] = React.useState(rscPayload);
    const [_isPending, startTransition] = React.useTransition();
    setRscPayload = (v) => startTransition(() => setStreamData(v));
    return React.use(streamData);
  }

  globalThis.__rsc_callServer = async function callServer(id, args) {
    const url = new URL(window.location.href);
    url.searchParams.set("__rsc", "");
    url.searchParams.set("__rsc_action_id", id);

    const streamData = createFromFetch(
      fetch(url, {
        method: "POST",
        body: await encodeReply(args),
      }),
      { callServer: globalThis.__rsc_callServer },
    );

    setRscPayload(streamData);
    const result = await streamData;
    return result.actionResult;
  };

  hydrateRoot(rootEl, <Content />);
}

init();
