import { createModuleMap } from "./createModuleMap.js";
import { createFromReadableStream } from "react-server-dom-webpack/client.edge";
import { use } from "react";
import { renderToReadableStream } from "react-dom/server.edge";

export const transformRscToHtmlStream = ({
  stream,
  Parent = ({ children }) => <>{children}</>,
}: {
  stream: ReadableStream;
  Parent: React.ComponentType<{ children: React.ReactNode }>;
}) => {
  const thenable = createFromReadableStream(stream, {
    ssrManifest: {
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
