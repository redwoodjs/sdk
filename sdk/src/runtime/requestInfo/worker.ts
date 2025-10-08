import { AsyncLocalStorage } from "async_hooks";
import { DefaultAppContext, RequestInfo } from "./types";

/**
 * A custom error class to signal that a request is being processed
 * on a stale context, likely due to an HMR update.
 */
export class StaleHmrRequestError extends Error {
  constructor() {
    super("Stale HMR Request");
    this.name = "StaleHmrRequestError";
  }
}

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
      if (!store) {
        // If the store is missing, it means this setter is being called on a
        // request that has been orphaned by an HMR update. We throw a
        // specific error to signal this condition so the main request
        // handler can catch it and short-circuit the request.
        throw new StaleHmrRequestError();
      }
      store[key] = value;
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
