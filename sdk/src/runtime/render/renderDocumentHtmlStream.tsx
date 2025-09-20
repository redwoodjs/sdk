import { use } from "react";
import { type DocumentProps } from "../lib/router.js";
import { type RequestInfo } from "../requestInfo/types.js";
import { Preloads } from "./preloads.js";
import { Stylesheets } from "./stylesheets.js";

import { createThenableFromReadableStream } from "./createThenableFromReadableStream.js";
import { renderToRscStream } from "./renderToRscStream.js";
import { renderHtmlStream } from "rwsdk/__ssr_bridge";

export const renderDocumentHtmlStream = async ({
  rscPayloadStream,
  Document,
  requestInfo,
  shouldSSR,
  onError,
}: {
  rscPayloadStream: ReadableStream;
  Document: React.FC<DocumentProps>;
  requestInfo: RequestInfo;
  shouldSSR: boolean;
  onError: (error: unknown) => void;
}) => {
  const Component = async () => {
    const { node } = await createThenableFromReadableStream(rscPayloadStream);
    // todo(justinvdm, 18 Jun 2025): We can build on this later to allow users
    // surface context. e.g:
    // * we assign `user: requestInfo.clientCtx` here
    // * user populates requestInfo.clientCtx on worker side
    // * user can import a read only `import { clientCtx } from "rwsdk/client"`
    // on client side
    const clientContext = {
      rw: {
        ssr: shouldSSR,
      },
    };

    return (
      <Document {...requestInfo}>
        <script
          nonce={requestInfo.rw.nonce}
          dangerouslySetInnerHTML={{
            __html: `globalThis.__RWSDK_CONTEXT = ${JSON.stringify(
              clientContext,
            )}`,
          }}
        />
        {/*
        <Stylesheets requestInfo={requestInfo} />
        <Preloads requestInfo={requestInfo} />
        */}
        <div id="hydrate-root">{node}</div>
      </Document>
    );
  };

  const htmlRscStream = renderToRscStream({
    input: <Component />,
    onError,
  });

  const htmlRscThenable = createThenableFromReadableStream(htmlRscStream);

  const htmlStream = await renderHtmlStream({
    node: htmlRscThenable,
    Document,
    requestInfo,
    shouldSSR,
    onError,
  });

  return htmlStream;
};
