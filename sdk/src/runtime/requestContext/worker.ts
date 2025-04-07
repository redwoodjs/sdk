import { AsyncLocalStorage } from "async_hooks";
import { RwContext } from "../lib/router";

export type RequestContext<Params = any, Data = Record<string, any>> = {
  request: Request;
  params: Params;
  data: Data;
  headers: Headers;
  rw: RwContext<Data>;
  cf: ExecutionContext;
};

const requestContextStore = new AsyncLocalStorage<Record<string, any>>();

const requestContextBase = {};

const CONTEXT_KEYS = ["request", "params", "data", "headers", "rw", "cf"];

CONTEXT_KEYS.forEach((key) => {
  Object.defineProperty(requestContextBase, key, {
    enumerable: true,
    configurable: false,
    get: function () {
      const store = requestContextStore.getStore();
      return store ? store[key] : undefined;
    },
  });
});

export const requestContext = Object.freeze(
  requestContextBase,
) as RequestContext;

export function getRequestContext<
  Data = Record<string, any>,
  TParams = any,
>(): RequestContext<Data, TParams> {
  const store = requestContextStore.getStore();
  if (!store) {
    throw new Error("Request context not found");
  }
  return store as RequestContext<Data, TParams>;
}

export function runWithRequestContext<Result>(
  context: Record<string, any>,
  fn: () => Result,
): Result {
  return requestContextStore.run(context, fn);
}

export function runWithRequestContextOverrides<Result>(
  overrides: Record<string, any>,
  fn: () => Result,
): Result {
  const context = requestContextStore.getStore();

  const newContext = {
    ...context,
    ...overrides,
  };

  return requestContextStore.run(newContext, fn);
}
