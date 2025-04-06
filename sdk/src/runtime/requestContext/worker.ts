import { AsyncLocalStorage } from "async_hooks";
import { RwContext } from "../lib/router";

const requestContextStore = new AsyncLocalStorage<Record<string, any>>();

const requestContextBase = {};

const contextKeys = ["userId", "requestId", "tenantId"];

contextKeys.forEach((key) => {
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
  cf: ExecutionContext;
  request: Request;
  params: TParams;
  env: Env;
  data: Data;
  headers: Headers;
  rw: RwContext<Data>;
};
