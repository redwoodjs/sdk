import { renderToReadableStream as baseRenderToRscStream } from "react-server-dom-webpack/server.edge";
import { createClientManifest } from "./createClientManifest.js";
import { runInReactRuntime } from 'vendor/react';

export const renderToRscStream = async (app: { node: React.ReactElement, actionResult: any }) => {
  return await runInReactRuntime("rsc", () => baseRenderToRscStream(app, createClientManifest()));
}