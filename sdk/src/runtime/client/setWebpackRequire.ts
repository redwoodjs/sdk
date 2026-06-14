import { clientWebpackRequire } from "../imports/client";

globalThis.__webpack_require__ = clientWebpackRequire;
globalThis.__vite_rsc_require__ = clientWebpackRequire;
