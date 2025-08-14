// note(justinvdm, 14 Aug 2025): Import order here is important. We use this to
// control what gets bundled into the main client bundle, or if it isnt bundled,
// when it gets fetched, and in both cases, the order in which code is evaluated.
// For instance, we need to set the `__webpack_require__` global before importing
// `react-server-dom-webpack/client.browser`.

// context(justinvdm, 14 Aug 2025): `react-server-dom-webpack` uses this global
// to load modules, so we need to define it here before importing
// "react-server-dom-webpack."
import "./setWebpackRequire";

// @ts-ignore
// context(justinvdm, 14 Aug 2025): We bundle the client lookup in the main client
// bundle so that we can find out client modules to fetch ASAP (no waterfall/round-trip delay)
export { useClientLookup } from "virtual:use-client-lookup.js";

import("./renderBlockers");
import("./interactivityBlockers");
