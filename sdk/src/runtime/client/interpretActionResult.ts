import {
  isRwsdkResponse,
  type RedirectDecision,
  type RwsdkResponse,
} from "./types";

export type InterpretedActionResult = {
  result: unknown;
  response?: RwsdkResponse;
  redirect: RedirectDecision;
};

export function interpretActionResult(
  result: unknown,
): InterpretedActionResult {
  if (!isRwsdkResponse(result)) {
    return { result, redirect: { kind: "none" } };
  }

  const { status, headers } = result.__rwsdk_response;
  const location = headers["location"];

  if (
    location &&
    (status === 301 ||
      status === 302 ||
      status === 303 ||
      status === 307 ||
      status === 308)
  ) {
    return {
      result,
      response: result,
      redirect: { kind: "redirect", url: location, status },
    };
  }

  return { result, response: result, redirect: { kind: "none" } };
}
