import { createModuleMap } from "./createModuleMap.js";
import { __switchReactRuntime } from "vendor/react";
import { ReactSSR, ReactDOMSSR } from "vendor/react-ssr";
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

  const Component = () => <Parent>{(ReactSSR.use(thenable) as { node: React.ReactNode }).node}</Parent>;

  const el = <Component />
  console.log('## rendering with ssr', el)
  __switchReactRuntime("ssr");
  return await ReactDOMSSR.renderToReadableStream(el);
};
