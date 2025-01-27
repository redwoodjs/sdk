/* eslint-disable no-var */
/// <reference types="react/experimental" />

import { CallServerCallback } from "react-server-dom-webpack/client.browser";
import { ViteHotContext } from "vite/types/hot";

declare global {
  var __webpack_require__: (id: string) => unknown;
  var __rsc_callServer: CallServerCallback;
  interface ImportMeta {
    readonly env: ImportMetaEnv;
    hot?: ViteHotContext;
  }

  interface ImportMetaEnv {
    readonly DEV: boolean;
  }
}

export {};
