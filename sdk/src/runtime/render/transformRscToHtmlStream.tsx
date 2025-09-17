import { createModuleMap } from "./createModuleMap.js";
import ReactServerDom from "react-server-dom-webpack/client.edge";
import { DocumentProps } from "../lib/router";
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
  console.log("--- DEBUG: [transformRscToHtmlStream] - Starting transform ---");

  const thenable = createFromReadableStream(stream, {
    serverConsumerManifest: {
      moduleMap: createModuleMap(),
      moduleLoading: null,
    },
  });

  const resultStream = renderRscThenableToHtmlStream({
    thenable,
    requestInfo,
    shouldSSR: requestInfo.rw.ssr,
    onError,
  });

  console.log(
    "--- DEBUG: [transformRscToHtmlStream] - Transform complete, returning stream promise ---",
  );

  return resultStream;
};
