import { DurableObject } from "cloudflare:workers";
import { RunnerEnv, RunnerRpc } from "./types.mjs";
import {
  ModuleEvaluator,
  ModuleRunner,
  ModuleRunnerOptions,
  ssrModuleExportsKey,
  type ModuleRunnerTransportHandlers,
} from "vite/module-runner";
import { HotPayload } from "vite";

let __viteModuleRunner: ModuleRunner | undefined = undefined

export class RunnerDO
  extends DurableObject<RunnerEnv>
  implements RunnerRpc {
  #runner?: ModuleRunner;
  #handlers?: ModuleRunnerTransportHandlers;

  async fetch(request: Request<any, any>) {
    return fetch(request, this.env, {
      waitUntil(_promise: Promise<any>) { },
      passThroughOnException() { },
    })
  }

  async initRunner() {
    const options: ModuleRunnerOptions = {
      root: this.env.__viteRoot,
      sourcemapInterceptor: "prepareStackTrace",
      hmr: true,
      transport: {
        invoke: (payload) => {
          return callBinding({
            binding: this.env.__viteInvoke,
            payload,
          })
        },
        connect: (handlers) => {
          this.#handlers = handlers;
        },
        send: (payload) =>
          callBinding({ binding: this.env.__viteSendToServer, payload }),
      },
    };

    this.#runner = new ModuleRunner(options, createEvaluator(this.env));
    __viteModuleRunner = this.#runner
  }

  async sendToRunner(payload: HotPayload): Promise<void> {
    // context(justinvdm, 10 Dec 2024): This is the handler side of the `sendToWorker` rpc method.
    // We're telling the runner: "here's a message from the server, do something with it".
    this.#handlers?.onMessage(payload);
  }
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
  if (!__viteModuleRunner) {
    throw new Error("Runner not initialized");
  }

  const entry = entryOverride ?? env.__viteWorkerEntry as string;
  const mod = await __viteModuleRunner.import(entry);

  const handler = mod.default as ExportedHandler;

  if (!handler[methodName]) {
    throw new Error(`Worker does not have a ${methodName} method`);
  }

  return run(handler[methodName]);
}

const fetch = (request: Request<any, any>, env: RunnerEnv, ctx: ExecutionContext) => {
  const options = request.headers.get("x-vite-fetch") ? JSON.parse(request.headers.get("x-vite-fetch")!) : undefined
  return proxyWorkerHandlerMethod({ methodName: "fetch" as const, entry: options?.entry, env, run: fn => fn(request, env, ctx) })
}

export default {
  fetch,
  tail: (events: TraceItem[], env: RunnerEnv, ctx: ExecutionContext) => {
    return proxyWorkerHandlerMethod({ methodName: "tail" as const, env, run: fn => fn(events as any, env, ctx) })
  },
  trace: (traces: TraceItem[], env: RunnerEnv, ctx: ExecutionContext) => {
    return proxyWorkerHandlerMethod({ methodName: "trace" as const, env, run: fn => fn(traces as any, env, ctx) })
  },
  scheduled: (controller: ScheduledController, env: RunnerEnv, ctx: ExecutionContext) => {
    return proxyWorkerHandlerMethod({ methodName: "scheduled" as const, env, run: fn => fn(controller, env, ctx) })
  },
  test: (controller: TestController, env: RunnerEnv, ctx: ExecutionContext) => {
    return proxyWorkerHandlerMethod({ methodName: "test" as const, env, run: fn => fn(controller, env, ctx) })
  },
}

export const createDurableObjectProxy = (scriptName: string, className: string) => {
  let instance: DurableObject

  const ensureExists = async (state: DurableObjectState, env: RunnerEnv) => {
    if (instance) {
      return instance
    }

    if (!__viteModuleRunner) {
      throw new Error("Runner not initialized");
    }

    const mod = await __viteModuleRunner.import(scriptName)
    const Constructor = mod[className]
    instance = new Constructor(state, env)
    return instance
  }

  return class DurableObjectProxy extends DurableObject<RunnerEnv> {
    constructor(public state: DurableObjectState, public env: RunnerEnv) {
      super(state, env);

      return new Proxy(this, {
        get(_target, prop, receiver) {
          const fn = async (...args: any[]) => {
            const instance = await ensureExists(state, env)
            return Reflect.get(instance, prop, receiver).call(instance, ...args)
          }

          return fn
        }
      })
    }
  }
}