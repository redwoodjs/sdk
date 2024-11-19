import { renderToReadableStream } from 'react-dom/server.edge'
import { createClientManifest } from './createClientManifest.js'

export const renderToRscStream = (app: React.ReactElement) =>
  renderToReadableStream(app, createClientManifest());
