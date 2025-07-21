/* eslint-disable no-var */
/// <reference types="react/experimental" />

import { CallServerCallback } from "react-server-dom-webpack/client.browser";

declare global {
  var __rsc_callServer: CallServerCallback;
  var __rw: {
    callServer: CallServerCallback;
    upgradeToRealtime: (options?: { key?: string }) => Promise<void>;
  };
}

export {};
