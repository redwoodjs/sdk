import { createModuleMap } from "./createModuleMap.js";
import ReactServerDom from "react-server-dom-webpack/client.edge";
import { renderRscThenableToHtmlStream } from "rwsdk/__ssr_bridge";
import { RequestInfo } from "../requestInfo/types";

const { createFromReadableStream } = ReactServerDom;

export const transformRscToHtmlStream = ({
  stream,
  requestInfo,
  onError,
}: {
  stream: ReadableStream;
  requestInfo: RequestInfo;
  onError: (error: unknown) => void;
}) => {
  const thenable = createFromReadableStream(stream, {
    serverConsumerManifest: {
      moduleMap: createModuleMap(),
      moduleLoading: null,
    },
  });

  return renderRscThenableToHtmlStream({
    thenable,
    requestInfo,
    onError,
  });
};
