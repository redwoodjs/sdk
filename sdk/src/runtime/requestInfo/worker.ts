import { AsyncLocalStorage } from "async_hooks";
import { experimental_taintObjectReference } from "react";
import { defineRwState } from "rwsdk/__state";
import { DefaultAppContext, RequestInfo } from "./types";

type DefaultRequestInfo = RequestInfo<DefaultAppContext>;

const requestInfoStore = defineRwState(
  "requestInfoStore",
  () => new AsyncLocalStorage<Record<string, any>>(),
);

const requestInfoBase = {};

const REQUEST_INFO_KEYS = ["request", "params", "ctx", "rw", "cf", "response"];

REQUEST_INFO_KEYS.forEach((key) => {
  Object.defineProperty(requestInfoBase, key, {
    enumerable: true,
    configurable: false,
    get: function () {
      const store = requestInfoStore.getStore();
      return store ? store[key] : undefined;
    },
  });
});

export const requestInfo: DefaultRequestInfo = Object.freeze(
  requestInfoBase,
) as DefaultRequestInfo;

if (typeof experimental_taintObjectReference === "function") {
  experimental_taintObjectReference(
    "Do not pass the full requestInfo object to Client Components. " +
      "Instead, pass only the specific data you need via props.",
    requestInfo,
  );
}

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
