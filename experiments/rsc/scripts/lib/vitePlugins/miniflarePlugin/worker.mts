import { DurableObject } from "cloudflare:workers";
import { RunnerEnv, RunnerRpc } from "./types.mjs";
import {
  ModuleRunner,
  type ModuleRunnerTransportHandlers,
} from "vite/module-runner";
import { HotPayload } from "vite";

export class Runner extends DurableObject<RunnerEnv> implements RunnerRpc {
  #runner?: ModuleRunner;
  #handlers?: ModuleRunnerTransportHandlers;

  async fetch(request: Request) {}

  async initRunner() {
    this.#runner = new ModuleRunner({
      root: this.env.__viteRoot,
      sourcemapInterceptor: "prepareStackTrace",
      hmr: true,
      transport: {
        invoke: (payload) =>
          callBinding({
            binding: this.env.__viteInvoke,
            payload,
          }),
        connect: (handlers) => {
          this.#handlers = handlers;
        },
        send: (payload) =>
          callBinding({ binding: this.env.__viteSendToServer, payload }),
      },
    });
  }

  async sendToWorker(payload: HotPayload): Promise<void> {
    // context(justinvdm, 10 Dec 2024): This is the handler side of the `sendToWorker` rpc method.
    // We're telling the runner: "here's a message from the server, do something with it".
    this.#handlers?.onMessage(payload);
  }
}

export async function callBinding<Result>({
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
