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
      if (store) {
        return store[key];
      }

      // context(justinvdm, 2025-10-08): During a chaotic HMR update, the async
      // context (store) can be torn down while a request is in-flight. If this
      // happens, we return an empty object for context properties instead of
      // undefined. This prevents a hard crash when middleware (like setupDb)
      // tries to set a property on the context of an already-orphaned request.
      if (key === "ctx" || key === "__userContext") {
        return {};
      }

      return undefined;
    },
    set: function (value) {
      const store = requestInfoStore.getStore();
      // context(justinvdm, 2025-10-08): Only set the value if the store exists.
      // If it doesn't, this is a no-op, which is the desired behavior for an
      // orphaned request.
      if (store) {
        store[key] = value;
      }
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
