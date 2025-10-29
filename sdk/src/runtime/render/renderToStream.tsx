import { FC, ReactElement } from "react";
import { injectRSCPayload } from "rsc-html-stream/server";
import { ssrWebpackRequire } from "../imports/worker.js";
import { DocumentProps } from "../lib/types.js";
import { type PartialRequestInfo } from "../requestInfo/types";
import { constructWithDefaultRequestInfo } from "../requestInfo/utils";
import { getRequestInfo, runWithRequestInfo } from "../requestInfo/worker";
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
  // Set __webpack_require__ if it doesn't exist
  if (!globalThis.__webpack_require__) {
    globalThis.__webpack_require__ = ssrWebpackRequire;
  }

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

  // context(gching, 2025-10-29): We wrap the following with context to the requestInfo
  // due to `ssrWebpackRequire` needing to reference the `requestInfo` in context.
  // Therefore, we need to wrap + also pass in the requestInfo their independent
  // function calls
  return runWithRequestInfo(requestInfo, async () => {
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
  });
};
