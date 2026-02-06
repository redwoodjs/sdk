// import type { CallServerCallback } from "react-server-dom-webpack/client.browser";

export type { HydrationOptions } from "react-dom/client";
// export type { CallServerCallback } from "react-server-dom-webpack/client.browser";

export type CallServerCallback = <Result>(
  id: null | string,
  args: null | unknown[],
  source?: "action" | "navigation" | "query",
  method?: "GET" | "POST",
) => Promise<Result | undefined>;

export type RscActionResponse<Result> = {
  node: React.ReactNode;
  actionResult: Result;
};

export type ActionResponseData = {
  status: number;
  statusText: string;
  headers: {
    location: string | null;
    [key: string]: string | null;
  };
};

export type ActionResponseMeta = {
  __rw_action_response: ActionResponseData;
};

export function isActionResponse(value: unknown): value is ActionResponseMeta {
  return (
    typeof value === "object" &&
    value !== null &&
    "__rw_action_response" in value &&
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
  onHydrated?: () => void;
  /**
   * Optional callback invoked when an action returns a Response.
   * Return true to signal that the response has been handled and
   * default behaviour (e.g. redirects) should be skipped.
   */
  onActionResponse?: (actionResponse: ActionResponseData) => boolean | void;
};

export type Transport = (context: TransportContext) => CallServerCallback;

export type CreateCallServer = (
  context: TransportContext,
) => <Result>(
  id: null | string,
  args: null | unknown[],
  source?: "action" | "navigation" | "query",
  method?: "GET" | "POST",
) => Promise<Result | undefined>;
