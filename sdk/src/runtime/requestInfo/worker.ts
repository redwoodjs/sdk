import { AsyncLocalStorage } from "async_hooks";
import { DefaultAppContext, RequestInfo } from "./types";

type DefaultRequestInfo = RequestInfo<DefaultAppContext>;

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
    set: function (value) {
      const store = requestInfoStore.getStore();
      if (store) {
        store[key] = value;
      }
    },
  });
});

export const requestInfo: DefaultRequestInfo = Object.freeze(
  requestInfoBase,
) as DefaultRequestInfo;

export function getRequestInfo(): RequestInfo | undefined {
  const store = requestInfoStore.getStore();
  return store as RequestInfo | undefined;
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
