/* eslint-disable no-var */
/// <reference types="react/experimental" />

import { CallServerCallback } from "react-server-dom-webpack/client.browser";

declare global {
  var __rsc_callServer: CallServerCallback;
  var __rw: {
    callServer: CallServerCallback;
    upgradeToRealtime: (options?: { key?: string }) => Promise<void>;
  };
  /**
   * When set, the next RSC fetch will use this href instead of window.location.href.
   * Cleared immediately after being consumed.
   */
  var __rw_nextFetchHref: string | null | undefined;
}

export {};
