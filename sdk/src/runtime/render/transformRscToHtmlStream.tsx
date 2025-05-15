import { createModuleMap } from "./createModuleMap.js";
import { createFromReadableStream } from "react-server-dom-webpack/client.edge";
import { use } from "react";
import { type RenderToReadableStreamOptions } from "react-dom/server.edge";

const renderToReadableStream = async (
  el: React.ReactNode,
  options?: RenderToReadableStreamOptions,
) => {
  const bridgePath = "rwsdk/__ssr_bridge";

  const { ssrRenderToReadableStream } = (await import(
    bridgePath
  )) as unknown as typeof import("./ssrBridge.js");

  return ssrRenderToReadableStream(el, options);
};

export const transformRscToHtmlStream = ({
  stream,
  Parent = ({ children }) => <>{children}</>,
  nonce,
}: {
  stream: ReadableStream;
  Parent: React.ComponentType<{ children: React.ReactNode }>;
  nonce?: string;
}) => {
  const thenable = createFromReadableStream(stream, {
    serverConsumerManifest: {
      moduleMap: createModuleMap(),
      moduleLoading: null,
    },
  });

  const Component = () => (
    <Parent>{(use(thenable) as { node: React.ReactNode }).node}</Parent>
  );
  const el = <Component />;

  return renderToReadableStream(el);
};
