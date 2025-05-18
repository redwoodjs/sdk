import React from "react";
import ReactServerDom from "react-dom/server.edge";
import { type DocumentProps } from "../lib/router";
import { type RequestInfo } from "../requestInfo/types";
import { AsyncResource } from "async_hooks";

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
  const resource = new AsyncResource("SSRStreamer");

  return resource.runInAsyncScope(() => {
    const Component = () => {
      return (
        <Document {...requestInfo}>
          {(use(thenable) as { node: React.ReactNode }).node}
        </Document>
      );
    };

    return renderToReadableStream(<Component />, {
      nonce: requestInfo.rw.nonce,
    });
  });
};
