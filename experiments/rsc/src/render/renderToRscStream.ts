import { renderToReadableStream } from "react-server-dom-webpack/server.edge";
import { createClientManifest } from './createClientManifest.js'

export const renderToRscStream = (app: React.ReactElement) =>
  renderToReadableStream(app, createClientManifest());
