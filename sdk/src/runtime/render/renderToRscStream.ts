import { renderToReadableStream as baseRenderToRscStream } from "react-server-dom-webpack/server.edge";
import { createClientManifest } from "./createClientManifest.js";

export const renderToRscStream = (app: {
  node: React.ReactElement;
  actionResult: any;
}) => baseRenderToRscStream(app, createClientManifest());
