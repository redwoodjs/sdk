import { renderToReadableStream as baseRenderToRscStream } from "react-server-dom-webpack/server.edge";
import { createClientManifest } from "./createClientManifest.js";
import { runInReactRuntime } from 'vendor/react';

export const renderToRscStream = (app: { node: React.ReactElement, actionResult: any }) =>
  runInReactRuntime("rsc", () => baseRenderToRscStream(app, createClientManifest()));