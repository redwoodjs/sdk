import { use } from "react";
import { renderToReadableStream } from "react-dom/server.edge";
import { type DocumentProps } from "../lib/router";
import { type RequestInfo } from "../requestInfo/types";

export const renderRscThenableToHtmlStream = async ({
  thenable,
  Document,
  requestInfo,
  shouldSSR,
}: {
  thenable: any;
  Document: React.FC<DocumentProps>;
  requestInfo: RequestInfo;
  shouldSSR: boolean;
}) => {
  const Component = () => {
    const node = (use(thenable) as { node: React.ReactNode }).node;
    return <Document {...requestInfo}>{node}</Document>;
  };

  return await renderToReadableStream(<Component />, {
    nonce: requestInfo.rw.nonce,
  });
};
