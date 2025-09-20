import { use } from "react";
import { type DocumentProps } from "../lib/router.js";
import { type RequestInfo } from "../requestInfo/types.js";
import { Preloads } from "./preloads.js";
import { Stylesheets } from "./stylesheets.js";

import { renderToRscStream } from "./renderToRscStream.js";
import {
  renderHtmlStream,
  createThenableFromReadableStream,
} from "rwsdk/__ssr_bridge";

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
  const rscAppThenable = createThenableFromReadableStream(rscPayloadStream);

  const Component = () => {
    const { node } = use(rscAppThenable) as { node: React.ReactNode };

    const rscAppHtml = use(
      renderHtmlStream({
        node,
        requestInfo,
        onError,
      }),
    );

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
        <div
          id="hydrate-root"
          dangerouslySetInnerHTML={{
            __html: rscAppHtml as unknown as string,
          }}
        />
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
    requestInfo,
    onError,
  });

  return htmlStream;
};
