import { AsyncLocalStorage } from "async_hooks";
import { RwContext } from "../lib/router";

export interface DefaultAppContext {}

export interface RequestInfo<Context = DefaultAppContext> {
  request: Request;
  params: Record<string, any>;
  ctx: Context;
  headers: Headers;
  rw: RwContext;
  cf: ExecutionContext;
}

const requestInfoStore = new AsyncLocalStorage<Record<string, any>>();

const requestInfoBase = {};

const REQUEST_INFO_KEYS = ["request", "params", "ctx", "headers", "rw", "cf"];

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

export const requestInfo: RequestInfo<DefaultAppContext> = Object.freeze(
  requestInfoBase,
) as RequestInfo<DefaultAppContext>;

export function getRequestInfo(): RequestInfo {
  const store = requestInfoStore.getStore();
  if (!store) {
    throw new Error("Request context not found");
  }
  return store as RequestInfo;
}

export function runWithRequestInfo<Result>(
  context: Record<string, any>,
  fn: () => Result,
): Result {
  return requestInfoStore.run(context, fn);
}

export function runWithRequestInfoOverrides<Result>(
  overrides: Record<string, any>,
  fn: () => Result,
): Result {
  const requestInfo = requestInfoStore.getStore();

  const newRequestInfo = {
    ...requestInfo,
    ...overrides,
  };

  return requestInfoStore.run(newRequestInfo, fn);
}
