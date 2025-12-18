import type { ActionResponse, RedirectDecision } from "./types";

export type InterpretedActionResult = {
  result: ActionResponse;
  response: ActionResponse;
  redirect: RedirectDecision;
};

export function interpretActionResult(
  result: ActionResponse,
): InterpretedActionResult {
  const { status, headers } = result.__rw_action_response;
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
