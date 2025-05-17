import { renderToReadableStream as baseRenderToRscStream } from "react-server-dom-webpack/server.edge";
import { createClientManifest } from "./createClientManifest.js";

// context(justinvdm, 24 Mar 2025): React flight limits chunks to 28 bytes, so we need to rechunk
// the stream to avoid losing data
function rechunkStream(
  stream: ReadableStream,
  maxChunkSize: number = 28,
): ReadableStream {
  const reader = stream.getReader();
  return new ReadableStream({
    async pull(controller) {
      let buffer = new Uint8Array(0);

      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done && buffer.length === 0) {
            controller.close();
            return;
          }

          if (value) {
            buffer = new Uint8Array([...buffer, ...value]);
          }

          while (buffer.length >= maxChunkSize || (done && buffer.length > 0)) {
            const chunk = buffer.slice(0, maxChunkSize);
            buffer = buffer.slice(maxChunkSize);
            controller.enqueue(chunk);
          }

          if (done) {
            controller.close();
            return;
          }
        }
      } catch (error) {
        controller.error(error);
      }
    },
  });
}

export const renderToRscStream = (app: {
  node: React.ReactElement;
  actionResult: any;
  onError?: (error: unknown) => void;
}): ReadableStream => {
  const { node, onError } = app;
  let { actionResult } = app;

  if (actionResult instanceof ReadableStream) {
    actionResult = rechunkStream(actionResult);
  }

  return baseRenderToRscStream({ node, actionResult }, createClientManifest(), {
    onError,
  });
};
