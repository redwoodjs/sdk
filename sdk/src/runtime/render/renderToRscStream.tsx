import { renderToReadableStream as baseRenderToRscStream } from "react-server-dom-webpack/server.edge";
import { createClientManifest } from "./createClientManifest.js";

export const renderToRscStream = ({
  input,
  onError,
}: {
  input: {
    node: React.ReactNode;
    actionResult: unknown;
  };
  onError?: (error: unknown) => void;
}): ReadableStream => {
  const { node: inputNode, actionResult } = input;

  // context(justinvdm, 2025-09-26): We add a marker here for our stitching logic in
  // renderDocumentHtmlStream() to find and use. It needs to live here rather than there,
  // since it needs to live in the RSC payload for hydration to work.
  const wrappedNode = (
    <>
      {inputNode}
      <div id="rwsdk-app-end" />
    </>
  );

  const wrappedInput = {
    node: wrappedNode,
    actionResult,
  };

  return baseRenderToRscStream(wrappedInput, createClientManifest(), {
    onError,
  });
};
