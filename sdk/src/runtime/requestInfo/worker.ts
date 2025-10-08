import { requestInfoStore } from "./storage";
import type { DefaultRequestInfo, RequestInfo } from "./types";

export const requestInfo: RequestInfo = {} as RequestInfo;

const REQUEST_INFO_KEYS = [
  "request",
  "params",
  "ctx",
  "rw",
  "cf",
  "response",
  "isAction",
  "__userContext",
];

REQUEST_INFO_KEYS.forEach((key) => {
  Object.defineProperty(requestInfo, key, {
    enumerable: true,
    configurable: false,
    get: function () {
      const store = requestInfoStore.getStore();
      return store ? store[key] : undefined;
    },
  });
});

export function getRequestInfo(): RequestInfo {
  const store = requestInfoStore.getStore();
  if (!store) {
    throw new Error("Request context not found");
  }
  return store as RequestInfo;
}

export function runWithRequestInfo<Result>(
  nextRequestInfo: DefaultRequestInfo,
  fn: () => Result,
): Result {
  return requestInfoStore.run(nextRequestInfo, fn);
}

export function runWithRequestInfoOverrides<Result>(
  overrides: Partial<DefaultRequestInfo>,
  fn: () => Result,
): Result {
  const requestInfo = requestInfoStore.getStore();

  const newRequestInfo = {
    ...requestInfo,
    ...overrides,
  } as DefaultRequestInfo;

  return runWithRequestInfo(newRequestInfo, fn);
}
