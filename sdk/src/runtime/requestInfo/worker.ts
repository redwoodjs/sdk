import { AsyncLocalStorage } from "async_hooks";
import { RequestInfo, DefaultAppContext } from "./types";

type DefaultRequestInfo = RequestInfo<DefaultAppContext>;

const requestInfoDeferred = Promise.withResolvers<DefaultRequestInfo>();

// context(agent, 2025-09-10): In development, Vite's dependency optimization
// can cause multiple instances of this module to be loaded. We use a global
// singleton to ensure that all instances share the same AsyncLocalStorage,
// preserving request context across reloads.
const requestInfoStore: AsyncLocalStorage<Record<string, any>> =
  import.meta.env.VITE_IS_DEV_SERVER && globalThis.__rwsdk_requestInfoStore
    ? globalThis.__rwsdk_requestInfoStore
    : new AsyncLocalStorage<Record<string, any>>();

if (import.meta.env.VITE_IS_DEV_SERVER) {
  globalThis.__rwsdk_requestInfoStore = requestInfoStore;
}

const requestInfoBase = {};

const REQUEST_INFO_KEYS = [
  "request",
  "params",
  "ctx",
  "headers",
  "rw",
  "cf",
  "response",
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

declare global {
  var __rwsdk_requestInfoStore: AsyncLocalStorage<Record<string, any>>;
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

  if (!requestInfo) {
    throw new Error("Cannot apply overrides: request context not found");
  }

  const newRequestInfo = Object.assign(
    requestInfo,
    overrides,
  ) as DefaultRequestInfo;

  return runWithRequestInfo(newRequestInfo, fn);
}
