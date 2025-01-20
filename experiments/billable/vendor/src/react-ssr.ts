import React from "react";

import { renderToReadableStream } from "react-dom/server.edge";

export const ReactSSR = React;

export const ReactDOMSSR = {
  renderToReadableStream,
};