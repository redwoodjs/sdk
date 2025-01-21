import { createModuleMap } from "./createModuleMap.js";
import { use, renderToHtmlStream } from "vendor/react-ssr";
import { createFromReadableStream } from "react-server-dom-webpack/client.edge";

export const transformRscToHtmlStream = async ({
  stream,
  Parent = ({ children }) => <>{children}</>,
}: {
  stream: ReadableStream;
  Parent?: React.ComponentType<{ children: React.ReactNode }>;
}) => {
  const thenable = createFromReadableStream(stream, {
    ssrManifest: {
      moduleMap: createModuleMap(),
      moduleLoading: null,
    },
  });

  const Component = () => <Parent>{use(thenable)}</Parent>;

  return await renderToHtmlStream(<Component />);
};
