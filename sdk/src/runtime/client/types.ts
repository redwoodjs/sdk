import type { CallServerCallback } from "react-server-dom-webpack/client.browser";

export type { HydrationOptions } from "react-dom/client";
export type { CallServerCallback } from "react-server-dom-webpack/client.browser";

export type ActionResponse<Result> = {
  node: React.ReactNode;
  actionResult: Result;
};

/**
 * Intermediate format for Response objects returned from server actions.
 * This allows Response objects (especially redirects) to be serialized
 * and handled on the client side.
 */
export type RwsdkResponse =
  | {
      __rwsdk_response: {
        type: "redirect";
        url: string;
        status: number;
      };
    }
  | {
      __rwsdk_response: {
        type: "other";
        status: number;
        statusText: string;
      };
    };

/**
 * Type guard to check if a value is an RwsdkResponse.
 */
export function isRwsdkResponse(value: unknown): value is RwsdkResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "__rwsdk_response" in value &&
    typeof (value as any).__rwsdk_response === "object" &&
    (value as any).__rwsdk_response !== null &&
    "type" in (value as any).__rwsdk_response
  );
}

/**
 * Type guard to check if a value is a redirect response.
 */
export function isRedirectResponse(
  value: unknown,
): value is Extract<RwsdkResponse, { __rwsdk_response: { type: "redirect" } }> {
  return (
    isRwsdkResponse(value) && value.__rwsdk_response.type === "redirect"
  );
}

export type TransportContext = {
  setRscPayload: <Result>(v: Promise<ActionResponse<Result>>) => void;
  handleResponse?: (response: Response) => boolean; // Returns false to stop normal processing
  /**
   * Optional callback invoked after a new RSC payload has been committed on the client.
   * This is useful for features like client-side navigation that want to run logic
   * after hydration/updates, e.g. warming navigation caches.
   */
  onHydrationUpdate?: () => void;
};

export type Transport = (context: TransportContext) => CallServerCallback;

export type CreateCallServer = (
  context: TransportContext,
) => <Result>(
  id: null | string,
  args: null | unknown[],
  source?: "action" | "navigation",
) => Promise<Result>;
