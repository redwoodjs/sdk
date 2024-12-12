import { readFile } from "node:fs/promises";
import { EventEmitter } from "node:events";
import { fileURLToPath } from "node:url";
import { resolve as importMetaResolve } from "import-meta-resolve";

import {
  DispatchFetch,
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
import { compileTsModule } from "../../compileTsModule.mjs";

interface MiniflarePluginOptions {
  entry: string;
  environment?: string;
  miniflare?: Partial<MiniflareOptions>;
}

type MiniflarePluginOptionsFull = NoOptionals<MiniflarePluginOptions>;

type HotDispatcher = (
  payload: HotPayload,
  client: { send: (payload: HotPayload) => void },
) => void;

type DevEnvApi = {
  dispatchFetch: DispatchFetch;
};

const readModule = (id: string) =>
  readFile(fileURLToPath(importMetaResolve(id, import.meta.url)), "utf8");

const readTsModule = async (id: string) => {
  const tsCode = await readModule(id);
  return compileTsModule(tsCode);
};

const createMiniflareOptions = async ({
  config,
  serviceBindings,
  options: { miniflare: userOptions },
}: {
  config: ResolvedConfig;
  serviceBindings: ServiceBindings;
  options: MiniflarePluginOptionsFull;
}): Promise<MiniflareOptions> => {
  // todo(justinvdm, 2024-12-10): Figure out what we can get from wrangler's unstable_getMiniflareWorkerOptions(),
  // and if it means we can avoid having both a wrangler.toml and miniflare config

  const worker: WorkerOptions = {
    modules: [
      {
        type: "ESModule",
        path: "__vite_worker__",
        contents: await readTsModule("./worker.mts"),
      },
      {
        type: "ESModule",
        path: "vite/module-runner",
        // todo(justinvdm, 2024-12-10): Figure out if we need to avoid new AsyncFunction during import side effect
        contents: await readModule("vite/module-runner"),
      },
    ],
    durableObjects: {
      __viteRunner: "RunnerWorker",
    },
    serviceBindings,
    bindings: {
      __viteRoot: config.root,
    },
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
  const { entry } = options;

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
      config,
      serviceBindings,
    }),
  );

  const ns = await miniflare.getDurableObjectNamespace("__viteRunner");
  const runnerWorker = ns.get(ns.idFromName("")) as unknown as RunnerWorkerApi;

  const { hotDispatch, transport } = createTransport({ runnerWorker });

  const dispatchFetch: DispatchFetch = async (input, init = {}) => {
    init.headers = new Headers(init.headers as HeadersInit | undefined);

    init.headers.set(
      "x-vite-fetch",
      JSON.stringify({ entry } satisfies FetchMetadata),
    );

    return await miniflare.dispatchFetch(input, init);
  };

  class MiniflareDevEnvironment extends DevEnvironment {
    api: DevEnvApi = {
      dispatchFetch,
    };

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

const createServerMiddleware = ({ dispatchFetch }: DevEnvApi) => {
  const miniflarePluginMiddleware: Connect.NextHandleFunction = async (
    request,
    response,
  ) => {
    const webRequest = nodeToWebRequest(request);
    const webResponse = await dispatchFetch(webRequest.url, webRequest);
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
      server.middlewares.use(
        createServerMiddleware(
          (server.environments[environment] as unknown as { api: DevEnvApi })
            .api,
        ),
      ),
  };
};
