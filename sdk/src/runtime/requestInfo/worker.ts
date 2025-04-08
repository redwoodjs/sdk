import { AsyncLocalStorage } from "async_hooks";
import { RwContext } from "../lib/router";

// context(justinvdm, 2025-04-08): Each app augment this declaration to add app-specific AppContext
export type DefaultAppContext = Record<string, any>;

export type DefaultParams = Record<string, any>;

export type RequestInfo<
  Params = DefaultParams,
  AppContext = DefaultAppContext,
> = {
  request: Request;
  params: Params;
  ctx: AppContext;
  headers: Headers;
  rw: RwContext<AppContext>;
  cf: ExecutionContext;
};

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

export const requestInfo = Object.freeze(requestInfoBase) as RequestInfo;

export function getRequestInfo<
  Data = Record<string, any>,
  Params = any,
>(): RequestInfo<Data, Params> {
  const store = requestInfoStore.getStore();
  if (!store) {
    throw new Error("Request context not found");
  }
  return store as RequestInfo<Data, Params>;
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
