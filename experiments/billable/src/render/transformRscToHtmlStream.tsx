import { createModuleMap } from "./createModuleMap.js";
import { ReactSSR, ReactDOMSSR } from "vendor/react-ssr";
import { createFromReadableStream } from "react-server-dom-webpack/client.edge";
import { runInReactRuntime } from 'vendor/react';

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
  return runInReactRuntime("ssr", () => ReactDOMSSR.renderToReadableStream(el));
};
