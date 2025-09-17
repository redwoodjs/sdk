import { ReactElement, FC } from "react";
import { DocumentProps } from "../lib/router.js";
import { renderToRscStream } from "./renderToRscStream.js";
import { transformRscToHtmlStream } from "./transformRscToHtmlStream.js";
import { requestInfo } from "../requestInfo/worker.js";
import { injectRSCPayload } from "rsc-html-stream/server";
import { renderDocumentToStream } from "rwsdk/__ssr_bridge";
import { assembleHtmlStreams } from "./assembleHtmlStreams.js";

export interface RenderToStreamOptions {
  Document?: FC<DocumentProps>;
  injectRscPayload?: boolean;
  onError?: (error: unknown) => void;
}

export const IdentityDocument: FC<DocumentProps> = ({ children }) => (
  <>{children}</>
);

export const renderToStream = async (
  element: ReactElement,
  {
    Document = IdentityDocument,
    injectRscPayload: shouldInjectRSCPayload = false,
    onError = () => {},
  }: RenderToStreamOptions = {},
): Promise<ReadableStream> => {
  console.log(
    "--- DEBUG: [renderToStream] - ENTRY POINT - Function called ---",
  );
  console.log("--- DEBUG: [renderToStream] - Element:", element);
  console.log("--- DEBUG: [renderToStream] - Document:", Document);
  console.log(
    "--- DEBUG: [renderToStream] - shouldInjectRSCPayload:",
    shouldInjectRSCPayload,
  );
  console.log(
    "--- DEBUG: [renderToStream] - About to call renderToRscStream ---",
  );
  let rscStream = renderToRscStream({
    node: element,
    actionResult: null,
    onError,
  });
  console.log(
    "--- DEBUG: [renderToStream] - renderToRscStream completed, got stream:",
    rscStream,
  );

  if (shouldInjectRSCPayload) {
    console.log("--- DEBUG: [renderToStream] - Injecting RSC payload ---");
    const [rscPayloadStream1, rscPayloadStream2] = rscStream.tee();
    rscStream = rscPayloadStream1;

    rscStream = rscStream.pipeThrough(
      injectRSCPayload(rscPayloadStream2, {
        nonce: requestInfo.rw.nonce,
      }),
    );
    console.log(
      "--- DEBUG: [renderToStream] - RSC payload injection complete ---",
    );
  }

  console.log(
    "--- DEBUG: [renderToStream] - About to call transformRscToHtmlStream ---",
  );
  const reactShellStream = await transformRscToHtmlStream({
    stream: rscStream,
    requestInfo,
    onError,
  });
  console.log(
    "--- DEBUG: [renderToStream] - transformRscToHtmlStream completed, got stream:",
    reactShellStream,
  );

  // Render the user's Document with a placeholder
  console.log(
    "--- DEBUG: [renderToStream] - About to render Document with placeholder ---",
  );
  const placeholder = `<div id="__RWS_APP_HTML__"></div>`;
  console.log("--- DEBUG: [renderToStream] - Placeholder:", placeholder);
  const documentStream = await renderDocumentToStream(
    Document,
    requestInfo,
    placeholder,
  );
  console.log(
    "--- DEBUG: [renderToStream] - renderDocumentToStream completed, got stream:",
    documentStream,
  );

  console.log(
    "--- DEBUG: [renderToStream] - About to call assembleHtmlStreams ---",
  );
  const result = assembleHtmlStreams({
    reactShellStream,
    documentStream,
    placeholder,
  });
  console.log(
    "--- DEBUG: [renderToStream] - assembleHtmlStreams completed, returning result:",
    result,
  );
  return result;
};
