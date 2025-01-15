import { DurableObject } from "cloudflare:workers";
import { FetchMetadata, RunnerEnv, RunnerRpc } from "./types.mjs";
import {
  ModuleEvaluator,
  ModuleRunner,
  ModuleRunnerOptions,
  ssrModuleExportsKey,
  type ModuleRunnerTransportHandlers,
} from "vite/module-runner";
import { HotPayload } from "vite";

type IncomingRequest = Request<unknown, IncomingRequestCfProperties<unknown>>;

export class RunnerWorker
  extends DurableObject<RunnerEnv>
  implements RunnerRpc {
  #runner?: ModuleRunner;
  #handlers?: ModuleRunnerTransportHandlers;

  override async fetch(request: IncomingRequest) {
    try {
      return await this.#fetch(request);
    } catch (e) {
      console.error(e);
      let body = "[vite workerd runner error]\n";
      if (e instanceof Error) {
        body += `${e.stack ?? e.message}`;
      }
      return new Response(body, { status: 500 });
    }
  }

  async #fetch(request: IncomingRequest) {
    if (!this.#runner) {
      throw new Error("Runner not initialized");
    }

    const options = JSON.parse(
      request.headers.get("x-vite-fetch")!,
    ) as FetchMetadata;

    const mod = await this.#runner.import(options.entry);

    const handler = mod.default as ExportedHandler;

    if (!handler.fetch) {
      throw new Error("Worker does not have a fetch method");
    }

    const env = Object.fromEntries(
      Object.entries(this.env).filter(([key]) => !key.startsWith("__vite")),
    );

    return handler.fetch(request, env, {
      waitUntil(_promise: Promise<any>) { },
      passThroughOnException() { },
    });
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
