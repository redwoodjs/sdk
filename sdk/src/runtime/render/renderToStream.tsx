import { FC, ReactElement } from "react";
import { injectRSCPayload } from "rsc-html-stream/server";
import { DocumentProps } from "../lib/types.js";
import { requestInfo } from "../requestInfo/worker";
import { renderDocumentHtmlStream } from "./renderDocumentHtmlStream";
import { renderToRscStream } from "./renderToRscStream";

export interface RenderToStreamOptions {
  Document?: FC<DocumentProps>;
  ssr?: boolean;
  injectRSCPayload?: boolean;
  onError?: (error: unknown) => void;
}

export const IdentityDocument: FC<DocumentProps> = ({ children }) => (
  <>{children}</>
);

export const renderToStream = async (
  element: ReactElement,
  {
    ssr: shouldSSR = true,
    Document = IdentityDocument,
    injectRSCPayload: shouldInjectRSCPayload = true,
    onError = () => {},
  }: RenderToStreamOptions = {},
): Promise<ReadableStream> => {
  let rscStream = renderToRscStream({
    input: {
      node: element,
      actionResult: undefined,
    },
    onError,
  });

  let injectRSCStream;

  if (shouldInjectRSCPayload) {
    const [rscPayloadStream1, rscPayloadStream2] = rscStream.tee();
    rscStream = rscPayloadStream1;
    injectRSCStream = injectRSCPayload(rscPayloadStream2, {
      nonce: requestInfo.rw.nonce,
    });
  }

  let htmlStream: ReadableStream<any> = await renderDocumentHtmlStream({
    rscPayloadStream: rscStream,
    Document,
    requestInfo,
    shouldSSR,
    onError,
  });

  if (injectRSCStream) {
    htmlStream = htmlStream.pipeThrough(injectRSCStream);
  }

  return htmlStream;
};
