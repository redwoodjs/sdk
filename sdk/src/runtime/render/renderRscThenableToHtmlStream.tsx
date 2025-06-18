import { Suspense, use } from "react";
import { renderToReadableStream } from "react-dom/server.edge";
import { type DocumentProps } from "../lib/router";
import { type RequestInfo } from "../requestInfo/types";

export const renderRscThenableToHtmlStream = async ({
  thenable,
  Document,
  requestInfo,
  shouldSSR,
}: {
  thenable: any;
  Document: React.FC<DocumentProps>;
  requestInfo: RequestInfo;
  shouldSSR: boolean;
}) => {
  const Component = () => {
    const node = (use(thenable) as { node: React.ReactNode }).node;

    // todo(justinvdm, 18 Jun 2025): We can leverage this for more client context things
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
        <div id="hydrate-root">
          {shouldSSR ? node : <Suspense fallback={null}>{node}</Suspense>}
        </div>
      </Document>
    );
  };

  return await renderToReadableStream(<Component />, {
    nonce: requestInfo.rw.nonce,
  });
};
