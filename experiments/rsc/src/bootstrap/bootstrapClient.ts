import { getSSRModuleExport } from "../register/rsc";

globalThis.__webpack_require__ = getSSRModuleExport;
