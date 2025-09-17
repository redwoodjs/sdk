import { FC } from "react";
import { renderToReadableStream } from "react-dom/server.edge";
import { DocumentProps } from "../lib/router.js";
import { RequestInfo } from "../requestInfo/types.js";

export const renderDocumentToStream = (
  Document: FC<DocumentProps>,
  props: RequestInfo,
  placeholder: string,
) => {
  return renderToReadableStream(
    <Document {...props}>
      <div dangerouslySetInnerHTML={{ __html: placeholder }} />
    </Document>,
  );
};
