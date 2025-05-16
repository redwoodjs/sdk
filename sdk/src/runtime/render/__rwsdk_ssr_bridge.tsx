import { use } from "react";
import { DocumentProps } from "../lib/router";
import { RequestInfo } from "../requestInfo/types";
import { renderToReadableStream } from "react-dom/server.edge";

export const renderRscThenableToHtmlStream = ({
  thenable,
  Document,
  requestInfo,
}: {
  thenable: any;
  Document: React.FC<DocumentProps>;
  requestInfo: RequestInfo;
}) => {
  const Component = () => (
    <Document {...requestInfo}>
      {(use(thenable) as { node: React.ReactNode }).node}
    </Document>
  );

  return renderToReadableStream(<Component />);
};
