import { use } from "react";
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
            __html: `globalThis.__RWSDK_CONTEXT = ${JSON.stringify(clientContext)}`,
          }}
        />
        <div id="hydrate-root">{node}</div>
      </Document>
    );
  };

  return await renderToReadableStream(<Component />, {
    nonce: requestInfo.rw.nonce,
  });
};
