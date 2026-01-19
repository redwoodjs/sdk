
import { requestInfo } from "./requestInfo/worker";

type Interruptor<TArgs extends any[] = any[], TResult = any> = (
  context: { request: Request; ctx: Record<string, any>; args: TArgs },
) => Promise<Response | void | TResult> | Response | void | TResult;

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
  fns: Interruptor<TArgs, TResult>[],
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
        // We can't easily return a Response from a server action function
        // because the return type is expected to be TResult.
        // However, if the interruptor returns a Response, it usually means "stop and return this HTTP response".
        // In the RSC context, throwing a Response is a common pattern to short-circuit.
        throw result;
      }
    }

    return mainFn(...args);
  };

  wrapped.method = options?.method ?? "POST"; // Default to POST if not specified, though user said serverQuery defaults to GET?
  // User said: "export const getProject = serverQuery(...) // Defaults to GET"
  // So serverQuery defaults to GET, serverAction defaults to POST?
  
  return wrapped;
}

export function serverQuery<TArgs extends any[] = any[], TResult = any>(
  fnsOrFn:
    | ServerFunction<TArgs, TResult>
    | (Interruptor<TArgs, TResult> | ServerFunction<TArgs, TResult>)[],
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

export function serverAction<TArgs extends any[] = any[], TResult = any>(
  fnsOrFn:
    | ServerFunction<TArgs, TResult>
    | (Interruptor<TArgs, TResult> | ServerFunction<TArgs, TResult>)[],
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
