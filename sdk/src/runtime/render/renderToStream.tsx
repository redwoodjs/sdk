import { ReactElement, FC } from "react";
import { DocumentProps } from "../lib/router";
import { renderToRscStream } from "./renderToRscStream";
import { transformRscToHtmlStream } from "./transformRscToHtmlStream";
import { requestInfo } from "../requestInfo/worker";
import { injectRSCPayload } from "rsc-html-stream/server";

export interface RenderToStreamOptions {
  Document?: FC<DocumentProps>;
  injectRSCPayload?: boolean;
  onError?: (error: unknown) => void;
}

export const IdentityDocument: FC<DocumentProps> = ({ children }) => (
  <>{children}</>
);

export const renderToStream = async (
  element: ReactElement,
  {
    Document = IdentityDocument,
    injectRSCPayload: shouldInjectRSCPayload = false,
    onError,
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

  const htmlStream = await transformRscToHtmlStream({
    stream: rscStream,
    Document,
    requestInfo,
  });

  return htmlStream;
};
