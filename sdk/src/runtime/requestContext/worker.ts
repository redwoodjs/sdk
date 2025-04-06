import { AsyncLocalStorage } from "async_hooks";
import { RwContext } from "../lib/router";

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

export const requestContext = Object.freeze(requestContextBase);

export function runWithRequestContext<T>(
  context: Record<string, any>,
  fn: () => T,
): T {
  return requestContextStore.run(context, fn);
}

export type RequestContext<Data = Record<string, any>, TParams = any> = {
  request: Request;
  params: TParams;
  data: Data;
  headers: Headers;
  rw: RwContext<Data>;
  cf: ExecutionContext;
};
