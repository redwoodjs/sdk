import { createModuleMap } from "./createModuleMap.js";
import ReactServerDom from "react-server-dom-webpack/client.edge";

const { createFromReadableStream } = ReactServerDom;

export const createThenableFromReadableStream = (stream: ReadableStream) =>
  createFromReadableStream(stream, {
    serverConsumerManifest: {
      moduleMap: createModuleMap(),
      moduleLoading: null,
    },
  });
