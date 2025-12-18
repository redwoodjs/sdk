import type { CallServerCallback } from "react-server-dom-webpack/client.browser";

export type { HydrationOptions } from "react-dom/client";
export type { CallServerCallback } from "react-server-dom-webpack/client.browser";

export type ActionResponse<Result> = {
  node: React.ReactNode;
  actionResult: Result;
};

export type RwsdkResponse = {
  __rwsdk_response: {
    status: number;
    statusText: string;
    headers: Record<string, string>;
  };
};

export function isRwsdkResponse(value: unknown): value is RwsdkResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "__rwsdk_response" in (value as any) &&
    typeof (value as any).__rwsdk_response === "object" &&
    (value as any).__rwsdk_response !== null
  );
}

export type RedirectDecision =
  | { kind: "none" }
  | { kind: "redirect"; url: string; status: number };

export type ActionResponseContext = {
  result: unknown;
  response?: RwsdkResponse;
  redirect: RedirectDecision;
};

export type TransportContext = {
  setRscPayload: <Result>(v: Promise<ActionResponse<Result>>) => void;
  handleResponse?: (response: Response) => boolean; // Returns false to stop normal processing
  /**
   * Optional callback invoked after a new RSC payload has been committed on the client.
   * This is useful for features like client-side navigation that want to run logic
   * after hydration/updates, e.g. warming navigation caches.
   */
  onHydrationUpdate?: () => void;
  /**
   * Optional callback invoked after an action result has been interpreted.
   * Return true to signal that the action response (including redirects)
   * has been handled and default behaviour should be skipped.
   */
  onActionResponse?: (ctx: ActionResponseContext) => boolean | void;
};

export type Transport = (context: TransportContext) => CallServerCallback;

export type CreateCallServer = (
  context: TransportContext,
) => <Result>(
  id: null | string,
  args: null | unknown[],
  source?: "action" | "navigation",
) => Promise<Result>;
