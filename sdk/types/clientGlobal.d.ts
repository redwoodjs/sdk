/* eslint-disable no-var */
/// <reference types="react/experimental" />

import { CallServerCallback } from "react-server-dom-webpack/client.browser";

declare global {
  var __rsc_callServer: (
    id: any,
    args: any,
    source?: "action" | "navigation" | "query",
    method?: "GET" | "POST",
  ) => Promise<any>;
  var __rw: {
    callServer: (
      id: any,
      args: any,
      source?: "action" | "navigation" | "query",
      method?: "GET" | "POST",
    ) => Promise<any>;
    upgradeToRealtime: (options?: { key?: string }) => Promise<void>;
  };
}

export {};
