import type { CallServerCallback } from "react-server-dom-webpack/client.browser";

export type { HydrationOptions } from "react-dom/client";
export type { CallServerCallback } from "react-server-dom-webpack/client.browser";

export type ActionResponse<Result> = {
  node: React.ReactNode;
  actionResult: Result;
};

export type TransportContext = {
  setRscPayload: <Result>(v: Promise<ActionResponse<Result>>) => void;
  handleResponse?: (response: Response) => boolean; // Returns false to stop normal processing
};

export type Transport = (context: TransportContext) => CallServerCallback;

export type CreateCallServer = (
  context: TransportContext,
) => <Result>(
  id: null | string,
  args: null | unknown[],
  source?: "action" | "navigation",
) => Promise<Result>;
