import { use } from "react";
import { renderToReadableStream } from "react-dom/server.edge";

import { type RequestInfo } from "../requestInfo/types.js";

export const renderRscThenableToHtmlStream = async ({
  thenable,
  requestInfo,
  onError,
}: {
  thenable: Promise<{ node: React.ReactNode }>;
  requestInfo: RequestInfo;
  onError?: (error: unknown) => void;
}) => {
  const App = () => {
    const { node } = use(thenable);
    return <div id="hydrate-root">{node}</div>;
  };

  const stream = await renderToReadableStream(<App />, {
    bootstrapModules: ["/src/client.tsx"],
    nonce: requestInfo.rw.nonce,
    onError,
  });

  return stream;
};
