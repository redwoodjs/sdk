import { requestInfo as requestInfoBase } from "./requestInfo/worker";
import { RequestInfo } from "./requestInfo/types";

export type Interruptor<TArgs extends any[] = any[], TResult = any> = (
  context: RequestInfo & { args: TArgs },
) => Promise<Response | void | TResult> | Response | void | TResult;

type ServerFunction<TArgs extends any[] = any[], TResult = any> = (
  ...args: TArgs
) => Promise<TResult>;

type ServerFunctionOptions = {
  method?: "GET" | "POST";
};

type WrappedServerFunction<TArgs extends any[] = any[], TResult = any> = {
  (...args: TArgs): Promise<TResult | any>;
  method?: "GET" | "POST";
};

function createServerFunction<TArgs extends any[] = any[], TResult = any>(
  fns: Interruptor<TArgs, TResult>[],
  mainFn: ServerFunction<TArgs, TResult>,
  options?: ServerFunctionOptions,
): WrappedServerFunction<TArgs, TResult> {
  const wrapped: WrappedServerFunction<TArgs, TResult> = async (
    ...args: TArgs
  ) => {
    for (const fn of fns) {
      const result = await fn({ ...requestInfoBase, args } as any);
      if (result === undefined) {
        continue;
      }

      if (result instanceof Response) {
        const headers = Object.fromEntries(result.headers.entries());
        const location = result.headers.get("location");
        if (location) {
          headers.location = location;
        }

        return {
          __rw_action_response: {
            status: result.status,
            statusText: result.statusText,
            headers,
          },
        };
      }

      if (result !== undefined) {
        return result;
      }
    }

    const result = await mainFn(...args);

    if (result instanceof Response) {
      const headers = Object.fromEntries(result.headers.entries());
      const location = result.headers.get("location");
      if (location) {
        headers.location = location;
      }

      return {
        __rw_action_response: {
          status: result.status,
          statusText: result.statusText,
          headers,
        },
      };
    }

    return result;
  };

  wrapped.method = options?.method;
  return wrapped;
}

/**
 * Wrap a function to be used as a server query.
 *
 * - **Method**: Defaults to `GET`. can be changed via `options`.
 * - **Behavior**: When called from the client, it returns data-only and does **not** rehydrate or re-render the React page.
 * - **Location**: Must be defined in a file with `"use server"`. We recommend `queries.ts` colocated with components.
 * - **Interruptors**: You can pass an array of functions as the first argument.
 *   - Return `undefined` to continue to the next interruptor/main function.
 *   - Return any value to short-circuit and use it as the query result.
 *   - Return/throw a `Response` to short-circuit with response metadata.
 *
 * @example
 * ```ts
 * // getters.ts
 * "use server"
 *
 * export const getUser = serverQuery(async (id: string) => {
 *   return db.user.findUnique({ where: { id } })
 * })
 * ```
 */
export function serverQuery<TArgs extends any[] = any[], TResult = any>(
  fns: [...Interruptor<TArgs, TResult>[], ServerFunction<TArgs, TResult>],
  options?: ServerFunctionOptions,
): WrappedServerFunction<TArgs, TResult>;
export function serverQuery<TArgs extends any[] = any[], TResult = any>(
  mainFn: ServerFunction<TArgs, TResult>,
  options?: ServerFunctionOptions,
): WrappedServerFunction<TArgs, TResult>;
export function serverQuery<TArgs extends any[] = any[], TResult = any>(
  fnsOrFn:
    | [...Interruptor<TArgs, TResult>[], ServerFunction<TArgs, TResult>]
    | ServerFunction<TArgs, TResult>,
  options?: ServerFunctionOptions,
): WrappedServerFunction<TArgs, TResult> {
  let fns: Interruptor<TArgs, TResult>[] = [];
  let mainFn: ServerFunction<TArgs, TResult>;

  if (Array.isArray(fnsOrFn)) {
    fns = fnsOrFn.slice(0, -1) as Interruptor<TArgs, TResult>[];
    mainFn = fnsOrFn[fnsOrFn.length - 1] as ServerFunction<TArgs, TResult>;
  } else {
    mainFn = fnsOrFn;
  }

  const method = options?.method ?? "GET"; // Default to GET for query
  const wrapped = createServerFunction(fns, mainFn, { ...options, method });
  wrapped.method = method;
  return wrapped;
}

/**
 * Wrap a function to be used as a server action.
 *
 * - **Method**: Defaults to `POST`. can be changed via `options`.
 * - **Behavior**: When called from the client, it **will** rehydrate and re-render the React page with the new server state.
 * - **Location**: Must be defined in a file with `"use server"`. We recommend `actions.ts` colocated with components.
 * - **Interruptors**: You can pass an array of functions as the first argument.
 *   - Return `undefined` to continue to the next interruptor/main function.
 *   - Return any value to short-circuit and use it as the action result.
 *   - Return/throw a `Response` to short-circuit with response metadata.
 *
 * @example
 * ```ts
 * // actions.ts
 * "use server"
 *
 * export const updateUser = serverAction(async (id: string, data: any) => {
 *   return db.user.update({ where: { id }, data })
 * })
 * ```
 */
export function serverAction<TArgs extends any[] = any[], TResult = any>(
  fns: [...Interruptor<TArgs, TResult>[], ServerFunction<TArgs, TResult>],
  options?: ServerFunctionOptions,
): WrappedServerFunction<TArgs, TResult>;
export function serverAction<TArgs extends any[] = any[], TResult = any>(
  mainFn: ServerFunction<TArgs, TResult>,
  options?: ServerFunctionOptions,
): WrappedServerFunction<TArgs, TResult>;
export function serverAction<TArgs extends any[] = any[], TResult = any>(
  fnsOrFn:
    | [...Interruptor<TArgs, TResult>[], ServerFunction<TArgs, TResult>]
    | ServerFunction<TArgs, TResult>,
  options?: ServerFunctionOptions,
): WrappedServerFunction<TArgs, TResult> {
  let fns: Interruptor<TArgs, TResult>[] = [];
  let mainFn: ServerFunction<TArgs, TResult>;

  if (Array.isArray(fnsOrFn)) {
    fns = fnsOrFn.slice(0, -1) as Interruptor<TArgs, TResult>[];
    mainFn = fnsOrFn[fnsOrFn.length - 1] as ServerFunction<TArgs, TResult>;
  } else {
    mainFn = fnsOrFn;
  }

  const method = options?.method ?? "POST"; // Default to POST for action
  const wrapped = createServerFunction(fns, mainFn, { ...options, method });
  wrapped.method = method;
  return wrapped;
}
