import React from "react";
import ReactServerDom from "react-dom/server.edge";
import { type DocumentProps } from "../lib/router";
import { type RequestInfo } from "../requestInfo/types";

const { use } = React;
const { renderToReadableStream } = ReactServerDom;

export const renderRscThenableToHtmlStream = async ({
  thenable,
  Document,
  requestInfo,
}: {
  thenable: any;
  Document: React.FC<DocumentProps>;
  requestInfo: RequestInfo;
}) => {
  const Component = () => {
    return (
      <Document {...requestInfo}>
        {(use(thenable) as { node: React.ReactNode }).node}
      </Document>
    );
  };

  return await renderToReadableStream(<Component />, {
    nonce: requestInfo.rw.nonce,
  });
};
