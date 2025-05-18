import { createModuleMap } from "./createModuleMap.js";
import ReactServerDom from "react-server-dom-webpack/client.edge";
import { DocumentProps } from "../lib/router";
import { renderRscThenableToHtmlStream } from "./__rwsdkssr_render.js";
import { RequestInfo } from "../requestInfo/types";
import { runWithRequestInfo } from "../requestInfo/worker.js";

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
  return runWithRequestInfo(requestInfo, () => {
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
    });
  });
};
