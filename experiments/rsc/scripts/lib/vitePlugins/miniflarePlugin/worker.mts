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
      transport: {
        hmr: true,
        async invoke(payload) {},
        connect: (handlers) => {
          this.#handlers = handlers;
        },
        async send(payload) {},
      },
    });
  }

  async sendToWorker(payload: HotPayload): Promise<void> {
    this.#handlers?.onMessage(payload);
  }
}

export function requestJson(data: unknown) {
  return new Request("https://any.local", {
    method: "POST",
    body: JSON.stringify(data),
  });
}
