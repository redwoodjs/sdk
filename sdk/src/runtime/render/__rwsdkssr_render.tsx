import React from "react";
import ReactServerDom from "react-dom/server.edge";
import { DocumentProps } from "../lib/router";
import { RequestInfo } from "../requestInfo/types";
import { requestInfo as importedRequestInfo } from "../requestInfo/worker";

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
  console.log(
    "#####################################################333",
    importedRequestInfo,
  );
  const Component = () => (
    <Document {...requestInfo}>
      {(use(thenable) as { node: React.ReactNode }).node}
    </Document>
  );

  return renderToReadableStream(<Component />, { nonce: requestInfo.rw.nonce });
};
