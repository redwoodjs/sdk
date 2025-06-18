import { createModuleMap } from "./createModuleMap.js";
import ReactServerDom from "react-server-dom-webpack/client.edge";
import { DocumentProps } from "../lib/router";
import { renderRscThenableToHtmlStream } from "rwsdk/__ssr_bridge";
import { RequestInfo } from "../requestInfo/types";
import { requestInfo } from "../requestInfo/worker";

const { createFromReadableStream } = ReactServerDom;

export const transformRscToHtmlStream = ({
  stream,
  Document,
  requestInfo,
}: {
  stream: ReadableStream;
  Document: React.FC<DocumentProps>;
  requestInfo: RequestInfo;
}) => {
  const thenable = createFromReadableStream(stream, {
    serverConsumerManifest: {
      moduleMap: createModuleMap(),
      moduleLoading: null,
    },
  });

  return renderRscThenableToHtmlStream({
    thenable,
    Document,
    requestInfo,
    shouldSSR: requestInfo.rw.ssr,
  });
};
