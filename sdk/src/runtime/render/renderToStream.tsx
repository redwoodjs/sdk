import { ReactElement, FC } from "react";
import { DocumentProps } from "../lib/router";
import { renderToRscStream } from "./renderToRscStream";
import { requestInfo } from "../requestInfo/worker";
import { injectRSCPayload } from "rsc-html-stream/server";
import { renderDocumentHtmlStream } from "./renderDocumentHtmlStream";

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
    injectRSCPayload: shouldInjectRSCPayload = false,
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
