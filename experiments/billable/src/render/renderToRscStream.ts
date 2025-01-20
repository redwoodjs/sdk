import { renderToReadableStream as baseRenderToRscStream } from "react-server-dom-webpack/server.edge";
import { __switchReactRuntime } from "vendor/react";
import { createClientManifest } from "./createClientManifest.js";

export const renderToRscStream = (app: React.ReactElement) => {
  __switchReactRuntime("ssr");
  return baseRenderToRscStream(app, createClientManifest());
}
