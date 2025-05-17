import { createModuleMap } from "./createModuleMap.js";
import ReactServerDom from "react-server-dom-webpack/client.edge";
import { DocumentProps } from "../lib/router";
import { renderRscThenableToHtmlStream } from "./__rwsdkssr_render.js";
import { requestInfo } from "../requestInfo/worker.js";

const { createFromReadableStream } = ReactServerDom;

export const transformRscToHtmlStream = ({
  stream,
  Document,
  nonce,
}: {
  stream: ReadableStream;
  Document: React.FC<DocumentProps>;
  nonce?: string;
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
    nonce,
  });
};
