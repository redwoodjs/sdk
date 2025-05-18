import React from "react";
import ReactServerDom from "react-dom/server.edge";
import { type DocumentProps } from "../lib/router";
import { type RequestInfo } from "../requestInfo/types";
import { runWithRequestInfo } from "../requestInfo/worker";

const { use } = React;
const { renderToReadableStream } = ReactServerDom;

export const renderRscThenableToHtmlStream = ({
  thenable,
  Document,
  requestInfo,
}: {
  thenable: any;
  Document: React.FC<DocumentProps>;
  requestInfo: RequestInfo;
}) => {
  return runWithRequestInfo(requestInfo, () => {
    const Component = () => (
      <Document {...requestInfo}>
        {(use(thenable) as { node: React.ReactNode }).node}
      </Document>
    );
    return renderToReadableStream(<Component />, {
      nonce: requestInfo.rw.nonce,
    });
  });
};
