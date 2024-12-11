import { readFile } from "node:fs/promises";
import { EventEmitter } from "node:events";
import { fileURLToPath } from "node:url";
import { resolve as importMetaResolve } from "import-meta-resolve";

import {
  Miniflare,
  MiniflareOptions,
  SharedOptions,
  WorkerOptions,
} from "miniflare";
import type { SourcelessWorkerOptions } from "wrangler";
import {
  Connect,
  DevEnvironment,
  HotChannel,
  HotPayload,
  Plugin,
  ResolvedConfig,
} from "vite";
import { nodeToWebRequest, webToNodeResponse } from "./requestUtils.mjs";
import {
  FetchMetadata,
  NoOptionals,
  RunnerWorkerApi,
  ServiceBindings,
} from "./types.mjs";

type HotDispatcher = (
  payload: HotPayload,
  client: { send: (payload: HotPayload) => void },
) => void;

interface MiniflarePluginOptions {
  entry: string;
  environment?: string;
  miniflare?: Partial<MiniflareOptions>;
}

type MiniflarePluginOptionsFull = NoOptionals<MiniflarePluginOptions>;

interface MiniflarePluginContext {
  options: NoOptionals<MiniflarePluginOptions>;
  miniflare: Miniflare;
  runnerWorker: RunnerWorkerApi;
  hotDispatch?: HotDispatcher;
}

const readModule = (id: string) =>
  readFile(fileURLToPath(importMetaResolve(id, import.meta.url)), "utf8");

const createMiniflareOptions = async ({
  serviceBindings,
  options: { miniflare: userOptions },
}: {
  serviceBindings: ServiceBindings;
  options: MiniflarePluginOptionsFull;
}): Promise<MiniflareOptions> => {
  // todo(justinvdm, 2024-12-10): Figure out what we can get from wrangler's unstable_getMiniflareWorkerOptions(),
  // and if it means we can avoid having both a wrangler.toml and miniflare config

  const worker: WorkerOptions = {
    modules: [
      {
        type: "ESModule",
        path: "vite/module-runner",
        // todo(justinvdm, 2024-12-10): Figure out if we need to avoid new AsyncFunction during import side effect
        contents: await readModule("vite/module-runner"),
      },
      {
        type: "ESModule",
        path: "__vite_worker__",
        contents: await readModule("./worker.mjs"),
      },
    ],
    durableObjects: {
      __viteRunner: "RunnerWorker",
    },
    serviceBindings,
  };

  return {
    ...userOptions,
    workers: [worker],
  } as MiniflareOptions & SharedOptions & SourcelessWorkerOptions;
};

const createTransport = ({
  runnerWorker,
}: {
  runnerWorker: RunnerWorkerApi;
}): {
  hotDispatch: HotDispatcher;
  transport: HotChannel;
} => {
  const events = new EventEmitter();

  const hotDispatch: HotDispatcher = (payload, client) => {
    if (payload.type === "custom") {
      events.emit(payload.event, payload.data, client);
    }
  };

  return {
    hotDispatch,
    transport: {
      // todo(justinvdm, 11 Dec 2024): Figure out if we need to implement these stubs
      listen: () => {},
      close: () => {},
      on: events.on.bind(events),
      off: events.off.bind(events),
      send: runnerWorker.sendToRunner.bind(runnerWorker),
    },
  };
};

const createDevEnv = async ({
  name,
  config,
  options,
}: {
  name: string;
  config: ResolvedConfig;
  options: MiniflarePluginOptionsFull;
}) => {
  const serviceBindings: ServiceBindings = {
    __viteInvoke: async (request) => {
      const payload = (await request.json()) as HotPayload;
      const result = await devEnv.hot.handleInvoke(payload);
      return Response.json(result);
    },
    __viteSendToServer: async (request) => {
      const payload = (await request.json()) as HotPayload;
      hotDispatch(payload, { send: runnerWorker.sendToRunner });
      return Response.json(null);
    },
  };

  const miniflare = new Miniflare(
    await createMiniflareOptions({
      options,
      serviceBindings,
    }),
  );

  const ns = await miniflare.getDurableObjectNamespace("__viteRunner");
  const runnerWorker = ns.get(ns.idFromName("")) as unknown as RunnerWorkerApi;

  const { hotDispatch, transport } = createTransport({ runnerWorker });

  class MiniflareDevEnvironment extends DevEnvironment {
    async close() {
      await super.close();
      await miniflare.dispose();
    }
  }

  const devEnv = new MiniflareDevEnvironment(name, config, {
    hot: true,
    transport,
  });

  await runnerWorker.initRunner();

  return devEnv;
};

const createServerMiddleware = ({
  miniflare,
  options: { entry },
}: MiniflarePluginContext) => {
  const miniflarePluginMiddleware: Connect.NextHandleFunction = async (
    request,
    response,
  ) => {
    const webRequest = nodeToWebRequest(request);

    webRequest.headers.set(
      "x-vite-fetch",
      JSON.stringify({ entry } satisfies FetchMetadata),
    );

    const webResponse = await miniflare.dispatchFetch(
      webRequest.url,
      webRequest,
    );
    await webToNodeResponse(webResponse, response);
  };

  return miniflarePluginMiddleware;
};

export const miniflarePlugin = async (
  givenOptions: MiniflarePluginOptions,
): Promise<Plugin> => {
  const options = {
    environment: "worker",
    miniflare: {},
    ...givenOptions,
  };

  const { environment } = options;

  return {
    name: "rw-reloaded-transform-jsx-script-tags",
    config: () => ({
      environments: {
        [environment]: {
          dev: {
            createEnvironment: (name: string, config: ResolvedConfig) =>
              createDevEnv({
                name,
                config,
                options,
              }),
          },
        },
      },
    }),
    configureServer: (server) => () =>
      server.middlewares.use(createServerMiddleware(pluginContext)),
  };
};
