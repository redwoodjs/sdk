import type { CallServerCallback } from "react-server-dom-webpack/client.browser";

export type { HydrationOptions } from "react-dom/client";
export type { CallServerCallback } from "react-server-dom-webpack/client.browser";

export type RscActionResponse<Result> = {
  node: React.ReactNode;
  actionResult: Result;
};

export type ActionResponseMeta = {
  status: number;
  statusText: string;
  headers: Record<string, string>;
};

export type ActionResponse = {
  __rw_action_response: ActionResponseMeta;
};

export function isActionResponse(value: unknown): value is ActionResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "__rw_action_response" in (value as any) &&
    typeof (value as any).__rw_action_response === "object" &&
    (value as any).__rw_action_response !== null
  );
}

export type TransportContext = {
  setRscPayload: <Result>(v: Promise<RscActionResponse<Result>>) => void;
  handleResponse?: (response: Response) => boolean; // Returns false to stop normal processing
  /**
   * Optional callback invoked after a new RSC payload has been committed on the client.
   * This is useful for features like client-side navigation that want to run logic
   * after hydration/updates, e.g. warming navigation caches.
   */
  onHydrationUpdate?: () => void;
  /**
   * Optional callback invoked when an action returns a Response.
   * Return true to signal that the response has been handled and
   * default behaviour (e.g. redirects) should be skipped.
   */
  onActionResponse?: (actionResponse: ActionResponseMeta) => boolean | void;
};

export type Transport = (context: TransportContext) => CallServerCallback;

export type CreateCallServer = (
  context: TransportContext,
) => <Result>(
  id: null | string,
  args: null | unknown[],
  source?: "action" | "navigation",
) => Promise<Result>;
