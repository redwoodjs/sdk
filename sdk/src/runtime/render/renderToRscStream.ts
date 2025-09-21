import { renderToReadableStream as baseRenderToRscStream } from "react-server-dom-webpack/server.edge";
import { createClientManifest } from "./createClientManifest.js";

export const renderToRscStream = ({
  input,
  onError,
}: {
  input: any;
  onError?: (error: unknown) => void;
}): ReadableStream => {
  return baseRenderToRscStream(input, createClientManifest(), {
    onError,
  });
};
