import type { RequestInfo } from "rwsdk/worker";

export function setCommonHeaders() {
  return ({ response }: RequestInfo) => {
    response.headers.set("Cache-Control", "no-store");
  };
}
