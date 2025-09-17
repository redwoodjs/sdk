import { ReactElement, FC } from "react";
import { DocumentProps } from "../lib/router.js";
import { renderToRscStream } from "./renderToRscStream.js";
import { transformRscToHtmlStream } from "./transformRscToHtmlStream.js";
import { requestInfo } from "../requestInfo/worker.js";
import { injectRSCPayload } from "rsc-html-stream/server";
import { renderDocumentToStream } from "rwsdk/__ssr_bridge";
import { StreamStitcher } from "../lib/StreamStitcher.js";
import {
  PreambleExtractor,
  BodyContentExtractor,
} from "../lib/streamExtractors.js";

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
  let rscStream = renderToRscStream({
    node: element,
    actionResult: null,
    onError,
  });

  if (shouldInjectRSCPayload) {
    const [rscPayloadStream1, rscPayloadStream2] = rscStream.tee();
    rscStream = rscPayloadStream1;

    rscStream = rscStream.pipeThrough(
      injectRSCPayload(rscPayloadStream2, {
        nonce: requestInfo.rw.nonce,
      }),
    );
  }

  const reactShellStream = await transformRscToHtmlStream({
    stream: rscStream,
    requestInfo,
    onError,
  });

  // Set up streaming extraction of the preamble and app body
  const [shellStreamForPreamble, shellStreamForBody] = reactShellStream.tee();

  const preambleExtractor = new PreambleExtractor();
  // Consume the stream for its side-effect of resolving the promise
  shellStreamForPreamble.pipeTo(preambleExtractor.writable);
  const preamblePromise = preambleExtractor.preamble;

  const bodyExtractor = new BodyContentExtractor();
  const appContentStream = shellStreamForBody.pipeThrough(bodyExtractor);

  // Render the user's Document with a placeholder
  const placeholder = `<div id="__RWS_APP_HTML__"></div>`;
  const documentStream = await renderDocumentToStream(
    Document,
    requestInfo,
    placeholder,
  );

  // Stitch them together using the generic StreamStitcher
  const stitcher = new StreamStitcher({
    stringReplacements: [
      {
        search: "</head>",
        replace: async () => {
          const preamble = await preamblePromise;
          return `${preamble}</head>`;
        },
      },
    ],
    streamReplacements: [
      {
        placeholder,
        stream: appContentStream,
      },
    ],
  });

  return documentStream.pipeThrough(stitcher);
};
