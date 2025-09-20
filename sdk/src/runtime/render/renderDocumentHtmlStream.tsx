import { use } from "react";
import { type DocumentProps } from "../lib/router.js";
import { type RequestInfo } from "../requestInfo/types.js";
import { Preloads } from "./preloads.js";
import { Stylesheets } from "./stylesheets.js";

import {
  renderHtmlStream,
  createThenableFromReadableStream,
} from "rwsdk/__ssr_bridge";
import { injectHtmlAtMarker } from "../lib/injectHtmlAtMarker.js";

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
  // Extract the app node from the RSC payload
  const rscAppThenable = createThenableFromReadableStream(rscPayloadStream);
  const { node: appNode } = (await rscAppThenable) as { node: React.ReactNode };

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

  // Create the outer document with a marker for injection
  const documentElement = (
    <Document {...requestInfo}>
      <script
        nonce={requestInfo.rw.nonce}
        dangerouslySetInnerHTML={{
          __html: `globalThis.__RWSDK_CONTEXT = ${JSON.stringify(
            clientContext,
          )}`,
        }}
      />
      <Stylesheets requestInfo={requestInfo} />
      <Preloads requestInfo={requestInfo} />
      <div
        id="hydrate-root"
        dangerouslySetInnerHTML={{ __html: "<!-- RWSDK_INJECT_APP_HTML -->" }}
      />
    </Document>
  );

  const outerHtmlStream = await renderHtmlStream({
    node: documentElement,
    requestInfo,
    onError,
  });

  const appHtmlStream = await renderHtmlStream({
    node: appNode,
    requestInfo,
    onError,
  });

  // Stitch the streams together
  const stitchedStream = injectHtmlAtMarker(
    outerHtmlStream,
    appHtmlStream,
    "<!-- RWSDK_INJECT_APP_HTML -->",
  );

  return stitchedStream;
};
