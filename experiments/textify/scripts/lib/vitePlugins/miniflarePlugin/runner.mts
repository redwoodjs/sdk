import { RunnerEnv } from "./types.mjs";
import {
  ModuleEvaluator,
  ModuleRunner,
  ModuleRunnerOptions,
  ssrModuleExportsKey,
  type ModuleRunnerTransportHandlers,
} from "vite/module-runner";
import { HotPayload } from "vite";

const STATE: {
  runner: ModuleRunner | undefined
  handlers: ModuleRunnerTransportHandlers | undefined
} = {
  runner: undefined,
  handlers: undefined,
}

const fetch = async (request: Request<any, any>, env: RunnerEnv, ctx: ExecutionContext) => {
  const {
    entry,
    instruction,
  }: {
    entry?: string
    instruction: string
  } = request.headers.get("x-vite-fetch") ? JSON.parse(request.headers.get("x-vite-fetch")!) : {}

  if (instruction === "proxy") {
    return proxyWorkerHandlerMethod({ methodName: "fetch" as const, entry, env, run: fn => fn(request, env, ctx) })
  }

  if (instruction === "init") {
    initRunner(env)
    return new Response("OK")
  }

  if (instruction === "send") {
    sendToRunner(await request.json())
    return new Response("OK")
  }

  throw new Error(`Unknown instruction: ${instruction}`)
}

export default {
  fetch,
  ...Object.fromEntries(
    (["tail", "trace", "scheduled", "test", "email", "queue"] as const)
      .map(methodName => [
        methodName,
        (arg0: any, env: RunnerEnv, ctx: ExecutionContext) => {
          return proxyWorkerHandlerMethod({ methodName, env, run: fn => fn(arg0 as any, env, ctx) })
        }
      ])
  ),
}

const initRunner = (env: RunnerEnv) => {
  const options: ModuleRunnerOptions = {
    root: env.__viteRoot,
    sourcemapInterceptor: "prepareStackTrace",
    hmr: true,
    transport: {
      invoke: (payload) => {
        return callBinding({
          binding: env.__viteInvoke,
          payload,
        })
      },
      connect: (handlers) => {
        STATE.handlers = handlers;
      },
      send: (payload) =>
        callBinding({ binding: env.__viteSendToServer, payload }),
    },
  };

  STATE.runner = new ModuleRunner(options, createEvaluator(env));
}

const sendToRunner = (payload: HotPayload) => {
  // context(justinvdm, 10 Dec 2024): This is the handler side of the `sendToWorker` rpc method.
  // We're telling the runner: "here's a message from the server, do something with it".
  STATE.handlers?.onMessage(payload);
}

export const createEvaluator = (env: RunnerEnv): ModuleEvaluator => ({
  async runInlinedModule(context, transformed, module) {
    // context(justinvdm, 2025-01-06): Sometimes we need to rely on miniflare to load modules (e.g. for WASM modules) instead
    // of evaluating code transformed by vite.
    // To do this, we:
    // 1. import() the module - this relies on these modules' contents having been provided to miniflare when instantiting it
    // 2. mimic the way vite collects exports for a module so that dependant modules can access it
    // todo(justinvdm, 2025-01-06): Clean this up: should work for things other than Prisma WASM, and exports other than default export
    if (module.file.includes('query_engine_bg')) {
      const result = await import(module.file)

      Object.defineProperty(context[ssrModuleExportsKey], "default", {
        enumerable: true,
        configurable: true,
        get() { return result.default }
      });

      Object.freeze(context[ssrModuleExportsKey]);
      return
    }

    if (
      module.file.includes("/node_modules") &&
      !module.file.includes("/node_modules/.vite")
    ) {
      throw new Error(
        `[Error] Trying to import non-prebundled module (only prebundled modules are allowed): ${module.id}` +
        "\n\n(have you excluded the module via `optimizeDeps.exclude`?)",
      );
    }

    const code = `'use strict';async (${Object.keys(context).join(
      ",",
    )})=>{{${transformed}\n\n}}`;

    const fn = env.__viteUnsafeEval.eval(code, module.id);

    try {
      await fn(...Object.values(context));
    } catch (e) {
      console.error("Error running", module.id);
      throw e;
    }

    Object.freeze(context[ssrModuleExportsKey]);
  },
  async runExternalModule(filepath) {
    if (filepath.startsWith('cloudflare:') || filepath.startsWith('node:')) {
      return import(filepath);
    }

    if (
      filepath.includes("/node_modules") &&
      !filepath.includes("/node_modules/.vite")
    ) {
      throw new Error(
        `[Error] Trying to import non-prebundled module (only prebundled modules are allowed): ${filepath}` +
        "\n\n(have you externalized the module via `resolve.external`?)",
      );
    }
    return import(filepath.slice('file://'.length));
  },
});

async function callBinding<Result>({
  binding,
  payload,
}: {
  binding: { fetch: (request: Request) => Promise<Response> };
  payload: HotPayload;
}) {
  const request = new Request("https://any.local", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  const response = await binding.fetch(request);

  if (!response.ok) {
    throw new Error(`Failed to call binding: ${response.statusText}`);
  }

  return response.json() as Result;
}

export const proxyWorkerHandlerMethod = async <Env extends Record<string, unknown>, MethodName extends keyof ExportedHandler<Env>>({
  methodName,
  entry: entryOverride,
  env, run
}: {
  methodName: MethodName,
  entry?: string,
  env: Env,
  run: (method: NonNullable<ExportedHandler<Env>[MethodName]>) => ReturnType<NonNullable<ExportedHandler<Env>[MethodName]>>
}) => {
  if (!STATE.runner) {
    throw new Error("Runner not initialized");
  }

  const entry = entryOverride ?? env.__viteWorkerEntry as string;
  const mod = await STATE.runner?.import(entry);

  const handler = mod.default as ExportedHandler;

  if (!handler[methodName]) {
    throw new Error(`Worker does not have a ${methodName} method`);
  }

  return run(handler[methodName]);
}
