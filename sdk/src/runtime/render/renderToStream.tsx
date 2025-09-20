import { ReactElement, FC } from "react";
import { DocumentProps } from "../lib/router";
import { renderToRscStream } from "./renderToRscStream";
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
    onError = () => {},
  }: RenderToStreamOptions = {},
): Promise<ReadableStream> => {
  let rscStream = renderToRscStream({
    input: element,
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

  // todo(justinvdm, 20 Sep 2025): Implement once idea proved out
  const htmlStream: any = 23;

  return htmlStream;
};
