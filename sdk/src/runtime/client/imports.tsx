// note(justinvdm, 14 Aug 2025): Import order here is important. We use this to
// control what gets bundled into the client bundle, and the order in which code
// is evaluated. For instance, we need to set the `__webpack_require__` global
// before importing `react-server-dom-webpack/client.browser`.

// context(justinvdm, 14 Aug 2025): `react-server-dom-webpack` uses this global
// to load modules, so we need to define it here before importing
// "react-server-dom-webpack."
import "./setWebpackRequire";

// @ts-ignore
export { useClientLookup } from "virtual:use-client-lookup.js";

export { default as React } from "react";

export { hydrateRoot } from "react-dom/client";
export {
  createFromFetch,
  encodeReply,
  createFromReadableStream,
} from "react-server-dom-webpack/client.browser";
export { rscStream } from "rsc-html-stream/client";

export type { CallServerCallback } from "react-server-dom-webpack/client.browser";
export type { HydrationOptions } from "react-dom/client";
