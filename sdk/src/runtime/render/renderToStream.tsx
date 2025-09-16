import { ReactElement, FC } from "react";
import { DocumentProps } from "../lib/router";
import { renderToRscStream } from "./renderToRscStream";
import { transformRscToHtmlStream } from "./transformRscToHtmlStream";
import { requestInfo } from "../requestInfo/worker";
import { injectRSCPayload } from "rsc-html-stream/server";
import { renderToReadableStream as renderToHtmlStream } from "react-dom/server.edge";

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

  // PASS 1: Get preamble and app from React's minimal shell
  const reactShellHtml = await new Response(reactShellStream).text();

  const preamble = reactShellHtml.match(/<head>(.*?)<\/head>/s)?.[1] ?? "";
  const appHtml = reactShellHtml.match(/<body.*?>(.*?)<\/body>/s)?.[1] ?? "";

  // PASS 2: Render the user's Document with a placeholder
  const placeholder = "__RWS_APP_HTML__";
  const documentStream = await renderToHtmlStream(
    <Document {...requestInfo}>{placeholder}</Document>,
  );
  const finalHtml = await new Response(documentStream).text();

  // Stitch them together
  const withApp = finalHtml.replace(placeholder, appHtml);
  const withPreamble = withApp.replace("</head>", `${preamble}</head>`);

  return new Response(withPreamble, {
    headers: { "Content-Type": "text/html" },
  }).body!;
};
