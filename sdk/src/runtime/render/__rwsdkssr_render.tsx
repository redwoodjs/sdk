import React from "react";
import ReactServerDom from "react-dom/server.edge";
import { DocumentProps } from "../lib/router";
import { RequestInfo } from "../requestInfo/types";

const { use } = React;
const { renderToReadableStream } = ReactServerDom;

export const renderRscThenableToHtmlStream = ({
  thenable,
  Document,
  requestInfo,
  nonce,
}: {
  thenable: any;
  Document: React.FC<DocumentProps>;
  requestInfo: RequestInfo;
  nonce?: string;
}) => {
  const Component = () => (
    <Document {...requestInfo}>
      {(use(thenable) as { node: React.ReactNode }).node}
    </Document>
  );

  return renderToReadableStream(<Component />, { nonce });
};
