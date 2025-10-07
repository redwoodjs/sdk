import { AsyncLocalStorage } from "async_hooks";
import { DefaultAppContext, RequestInfo } from "./types";

type DefaultRequestInfo = RequestInfo<DefaultAppContext>;

const requestInfoDeferred = Promise.withResolvers<DefaultRequestInfo>();

const requestInfoStore = new AsyncLocalStorage<Record<string, any>>();

const requestInfoBase = {};

const REQUEST_INFO_KEYS = [
  "request",
  "params",
  "ctx",
  "rw",
  "cf",
  "response",
  "__userContext",
];

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

export function getRequestInfo(): RequestInfo {
  const store = requestInfoStore.getStore();
  if (!store) {
    throw new Error("Request context not found");
  }
  return store as RequestInfo;
}

export function waitForRequestInfo() {
  return requestInfoDeferred.promise;
}

export function runWithRequestInfo<Result>(
  nextRequestInfo: DefaultRequestInfo,
  fn: () => Result,
): Result {
  const runWithRequestInfoFn = () => {
    requestInfoDeferred.resolve(nextRequestInfo);
    return fn();
  };
  return requestInfoStore.run(nextRequestInfo, runWithRequestInfoFn);
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
