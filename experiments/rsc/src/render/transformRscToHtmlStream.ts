import { createFromReadableStream } from 'react-server-dom-webpack/client.edge'
import { createClientManifest } from './createClientManifest.js'

export const transformRscToHtmlStream = (stream: ReadableStream) =>
  createFromReadableStream(stream, createClientManifest())
