import { ssrWebpackRequire } from "../register/rsc";

globalThis.__webpack_require__ = ssrWebpackRequire;
