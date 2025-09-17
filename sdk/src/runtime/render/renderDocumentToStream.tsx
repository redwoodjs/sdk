import React, { FC } from "react";
import { renderToReadableStream } from "react-dom/server.edge";
import { DocumentProps } from "../lib/router.js";
import { RequestInfo } from "../requestInfo/types.js";

export const renderDocumentToStream = (
  Document: FC<DocumentProps>,
  props: RequestInfo,
  placeholder: string,
) => {
  // @ts-expect-error RSCs can't be passed as children
  return renderToReadableStream(<Document {...props}>{placeholder}</Document>);
};
