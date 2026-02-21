
import { requestInfo } from "./requestInfo/worker";

type Interruptor<TArgs extends any[] = any[]> = (
  context: { request: Request; ctx: Record<string, any>; args: TArgs },
) => Promise<Response | void> | Response | void;

type ServerFunction<TArgs extends any[] = any[], TResult = any> = (
  ...args: TArgs
) => Promise<TResult>;

type ServerFunctionOptions = {
  method?: "GET" | "POST";
};

type WrappedServerFunction<TArgs extends any[] = any[], TResult = any> = {
  (...args: TArgs): Promise<TResult>;
  method?: "GET" | "POST";
};

function createServerFunction<TArgs extends any[] = any[], TResult = any>(
  fns: Interruptor<TArgs>[],
  mainFn: ServerFunction<TArgs, TResult>,
  options?: ServerFunctionOptions,
): WrappedServerFunction<TArgs, TResult> {
  const wrapped: WrappedServerFunction<TArgs, TResult> = async (
    ...args: TArgs
  ) => {
    const { request, ctx } = requestInfo;

    // Execute interruptors
    for (const fn of fns) {
      const result = await fn({ request, ctx, args });
      if (result instanceof Response) {
        // We return the Response so it can be handled by the action handler
        // and serialized into the RSC stream via normalizeActionResult.
        return result as unknown as TResult;
      }
    }

    return mainFn(...args);
  };

  wrapped.method = options?.method ?? "POST";

  return wrapped;
}

/**
 * Wrap a function to be used as a server query.
 *
 * - **Method**: Defaults to `GET`. can be changed via `options`.
 * - **Behavior**: When called from the client, it returns data-only and does **not** rehydrate or re-render the React page.
 * - **Location**: Must be defined in a file with `"use server"`. We recommend `queries.ts` colocated with components.
 * - **Middleware**: You can pass an array of functions as the first argument to act as interruptors (e.g. for auth).
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
export function serverQuery<TArgs extends any[], TResult>(
  fnsOrFn:
    | ServerFunction<TArgs, TResult>
    | [...Interruptor<TArgs>[], ServerFunction<TArgs, TResult>],
  options?: ServerFunctionOptions,
): WrappedServerFunction<TArgs, TResult> {
  let fns: Interruptor<TArgs>[] = [];
  let mainFn: ServerFunction<TArgs, TResult>;

  if (Array.isArray(fnsOrFn)) {
    fns = fnsOrFn.slice(0, -1) as Interruptor<TArgs>[];
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
 * - **Middleware**: You can pass an array of functions as the first argument to act as interruptors (e.g. for auth).
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
export function serverAction<TArgs extends any[], TResult>(
  fnsOrFn:
    | ServerFunction<TArgs, TResult>
    | [...Interruptor<TArgs>[], ServerFunction<TArgs, TResult>],
  options?: ServerFunctionOptions,
): WrappedServerFunction<TArgs, TResult> {
  let fns: Interruptor<TArgs>[] = [];
  let mainFn: ServerFunction<TArgs, TResult>;

  if (Array.isArray(fnsOrFn)) {
    fns = fnsOrFn.slice(0, -1) as Interruptor<TArgs>[];
    mainFn = fnsOrFn[fnsOrFn.length - 1] as ServerFunction<TArgs, TResult>;
  } else {
    mainFn = fnsOrFn;
  }

  const method = options?.method ?? "POST"; // Default to POST for action
  const wrapped = createServerFunction(fns, mainFn, { ...options, method });
  wrapped.method = method;
  return wrapped;
}
