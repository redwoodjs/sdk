import { ReactElement } from "react";
import { renderToRscStream } from "./renderToRscStream.js";
import { transformRscToHtmlStream } from "./transformRscToHtmlStream.js";
import { requestInfo } from "../requestInfo/worker.js";
import { injectRSCPayload } from "rsc-html-stream/server";

export interface RenderToStreamOptions {
  injectRscPayload?: boolean;
  onError?: (error: unknown) => void;
}

export const renderToStream = async (
  element: ReactElement,
  {
    injectRscPayload: shouldInjectRSCPayload = false,
    onError = () => {},
  }: RenderToStreamOptions = {},
): Promise<ReadableStream> => {
  let rscStream = renderToRscStream({
    node: element,
    actionResult: null,
    onError,
  });

  let rscPayloadStream: ReadableStream | undefined;
  if (shouldInjectRSCPayload) {
    const [rscStreamForHtml, rscStreamForPayload] = rscStream.tee();
    rscStream = rscStreamForHtml;
    rscPayloadStream = rscStreamForPayload;
  }

  const appStream = await transformRscToHtmlStream({
    stream: rscStream,
    requestInfo,
    onError,
  });

  if (shouldInjectRSCPayload && rscPayloadStream) {
    return appStream.pipeThrough(
      injectRSCPayload(rscPayloadStream, {
        nonce: requestInfo.rw.nonce,
      }),
    );
  }

  return appStream;
};
