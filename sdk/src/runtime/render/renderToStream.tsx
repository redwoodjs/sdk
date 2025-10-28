import { FC, ReactElement } from "react";
import { injectRSCPayload } from "rsc-html-stream/server";
import { DocumentProps } from "../lib/types.js";
import { type PartialRequestInfo } from "../requestInfo/types";
import { constructWithDefaultRequestInfo } from "../requestInfo/utils";
import { getRequestInfo } from "../requestInfo/worker";
import { renderDocumentHtmlStream } from "./renderDocumentHtmlStream";
import { renderToRscStream } from "./renderToRscStream";

export interface RenderToStreamOptions {
  Document?: FC<DocumentProps>;
  ssr?: boolean;
  injectRSCPayload?: boolean;
  onError?: (error: unknown) => void;
  requestInfo?: PartialRequestInfo;
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
    requestInfo: givenRequestInfo,
    onError = () => {},
  }: RenderToStreamOptions = {},
): Promise<ReadableStream> => {
  // Try to get the context requestInfo from the async store.
  let contextRequestInfo;
  try {
    contextRequestInfo = getRequestInfo();
  } catch (e) {
    // No requestInfo detected from store.
  }

  // Construct requestInfo with defaults where overrides take precedence.
  // If provided, `givenRequestInfo` will override values from context requestInfo if it exists
  const requestInfo = constructWithDefaultRequestInfo({
    ...contextRequestInfo,
    ...givenRequestInfo,
    rw: {
      ...contextRequestInfo?.rw,
      ...givenRequestInfo?.rw,
    },
  });

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
