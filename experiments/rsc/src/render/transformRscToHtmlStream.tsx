import { createModuleMap } from "./createModuleMap.js";
import { use, renderToHtmlStream } from "vendor/react-ssr";
import { createFromReadableStream } from "vendor/react-rsc-worker";

export const transformRscToHtmlStream = async (stream: ReadableStream) => {
  const thenable = createFromReadableStream(stream, {
    ssrManifest: {
      moduleMap: createModuleMap(),
      moduleLoading: null,
    },
  });

  const Component = () => <>{use(thenable)}</>;

  return await renderToHtmlStream(<Component />);
};
