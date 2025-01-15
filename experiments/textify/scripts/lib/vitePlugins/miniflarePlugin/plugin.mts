import { config as dotEnvConfig } from "dotenv";
import { readFile } from "node:fs/promises";
import { EventEmitter } from "node:events";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { createRequire } from "node:module";

import { resolve as importMetaResolve } from "import-meta-resolve";
import colors from "picocolors";

import {
  mergeWorkerOptions,
  Miniflare,
  MiniflareOptions,
  SharedOptions,
  WorkerOptions,
} from "miniflare";
import { unstable_readConfig, unstable_getMiniflareWorkerOptions, type SourcelessWorkerOptions, type Unstable_MiniflareWorkerOptions, unstable_dev } from "wrangler";
import {
  Connect,
  DevEnvironment,
  HotChannel,
  HotPayload,
  Plugin,
  ResolvedConfig,
} from "vite";
import { nodeToWebRequest, webToNodeResponse } from "../requestUtils.mjs";
import {
  FetchMetadata,
  NoOptionals,
  RunnerWorkerApi,
  ServiceBindings,
} from "./types.mjs";
import { compileTsModule } from "../../compileTsModule.mjs";
import { getShortName } from "../../getShortName.mjs";
import { SRC_DIR } from "../../constants.mjs";

const __dirname = new URL(".", import.meta.url).pathname;

interface MiniflarePluginOptions {
  entry: string;
  environment?: string;
  miniflare?: Partial<MiniflareOptions>;
  rootDir?: string;
}

type MiniflarePluginOptionsFull = NoOptionals<MiniflarePluginOptions>;

type HotDispatcher = (
  payload: HotPayload,
  client: { send: (payload: HotPayload) => void },
) => void;

type DevEnvApi = {
  dispatchFetch: (request: Request) => Promise<Response>;
};

const readModule = (id: string) =>
  readFile(fileURLToPath(importMetaResolve(id, import.meta.url)), "utf8");

const readTsModule = async (id: string) => {
  const tsCode = await readModule(id);
  return compileTsModule(tsCode);
};


const loadGeneratedPrismaModule = async (id: string) => {
  // context(justinvdm, 2025-01-06): Resolve relative to @prisma/client since pnpm places it relative to @prisma/client in node_modules/.pnpm
  const resolvedId = createRequire(importMetaResolve('@prisma/client', import.meta.url)).resolve(id)

  return {
    path: resolvedId.slice(1),
    contents: await readFile(resolvedId)
  }
}

export const setupAiWorker = async (workerOptions: SourcelessWorkerOptions | undefined) => {
  // context(justinvdm, 2025-01-15): Do similar to what wrangler does to hook up the AI worker, except we delegate to
  // a wrangler dev worker specific to doing AI worker tasks
  // https://github.com/cloudflare/workers-sdk/blob/6fe9533897b61ae9ef6566b5d2bdf09698566c24/packages/wrangler/src/dev/miniflare.ts#L579
  const aiDevWorker = await unstable_dev(resolve(__dirname, 'aiScript.js'), {
    port: 0,
    ai: {
      binding: 'AI'
    },
  })

  process.on('exit', () => {
    aiDevWorker.stop()
  })

  return {
    name: '__WRANGLER_EXTERNAL_AI_WORKER',
    modules: [
      {
        type: "ESModule",
        path: "index.mjs",
        contents: `
import { Ai } from 'cloudflare-internal:ai-api'

export default function (env) {
    return new Ai(env.FETCHER);
}
`,
      },
    ],
    serviceBindings: {
      FETCHER: aiDevWorker.fetch,
    },
  };
}

const createMiniflareOptions = async ({
  config,
  serviceBindings,
  options: { miniflare: userOptions, rootDir },
}: {
  config: ResolvedConfig;
  serviceBindings: ServiceBindings;
  options: MiniflarePluginOptionsFull;
}): Promise<MiniflareOptions> => {
  let configWorkerOptions: SourcelessWorkerOptions | undefined;

  if (rootDir) {
    const config = unstable_readConfig({ config: resolve(rootDir, "wrangler.toml") }, {});
    configWorkerOptions = unstable_getMiniflareWorkerOptions(config).workerOptions
  }

  const runnerOptions: WorkerOptions = {
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
      // todo(justinvdm, 2025-01-06): Clean this up - we should support loading specific modules directly from miniflare in general
      // rather than hardcoded prisma wasm case only
      {
        type: "CommonJS",
        ...await loadGeneratedPrismaModule('.prisma/client/query_engine_bg.js'),
      },
      {
        type: "CompiledWasm",
        ...await loadGeneratedPrismaModule('.prisma/client/query_engine_bg.wasm'),
      },
    ],
    unsafeEvalBinding: "__viteUnsafeEval",
    durableObjects: {
      __viteRunner: "RunnerWorker",
    },
    serviceBindings,
    bindings: {
      __viteRoot: config.root,
    },
  };

  const baseOptions = {
    modules: true,
    d1Persist: resolve(rootDir, ".wrangler/state/v3/d1"),
    r2Persist: resolve(rootDir, ".wrangler/state/v3/r2"),
    bindings: dotEnvConfig({
      path: resolve(rootDir, ".env"),
    }).parsed ?? {},
  } as MiniflareOptions

  const workerOptions = mergeWorkerOptions(configWorkerOptions ?? {}, mergeWorkerOptions(userOptions, runnerOptions));

  const workers: SourcelessWorkerOptions[] = [workerOptions]

  if (configWorkerOptions?.wrappedBindings?.AI) {
    const aiWorker = await setupAiWorker(configWorkerOptions)
    workers.push(aiWorker)
  }

  return {
    ...baseOptions,
    workers
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
      listen: () => { },
      close: () => { },
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

  const redirectToSelf = async (req: Request) => {
    await new Promise((resolve) => setTimeout(resolve, 200));

    return new Response(null, {
      status: 302,
      headers: {
        Location: req.url,
      },
    });
  };

  const dispatchFetch: DevEnvApi["dispatchFetch"] = async (request) => {
    if (devEnv.discarded) {
      return redirectToSelf(request);
    }

    if (!request.headers.has("x-vite-fetch")) {
      request.headers.set(
        "x-vite-fetch",
        JSON.stringify({ entry } satisfies FetchMetadata),
      );
    }

    try {
      return await runnerWorker.fetch(request.url, request);
    } catch (e) {
      if (devEnv.discarded) {
        return redirectToSelf(request);
      }

      throw e;
    }
  };

  class MiniflareDevEnvironment extends DevEnvironment {
    discarded: boolean = false;

    api: DevEnvApi = {
      dispatchFetch,
    };

    async close() {
      this.discarded = true;
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
    const webResponse = await dispatchFetch(webRequest);
    await webToNodeResponse(webResponse, response);
  };

  return miniflarePluginMiddleware;
};

const hasEntryAsAncestor = (module: any, entryFile: string, seen = new Set()): boolean => {
  // Prevent infinite recursion
  if (seen.has(module)) return false;
  seen.add(module);

  // Check direct importers
  for (const importer of module.importers) {
    if (importer.file === entryFile) return true;

    // Recursively check importers
    if (hasEntryAsAncestor(importer, entryFile, seen)) return true;
  }
  return false;
};

export const miniflarePlugin = async (
  givenOptions: MiniflarePluginOptions,
): Promise<Plugin> => {
  const options = {
    environment: "worker",
    miniflare: {},
    rootDir: process.cwd(),
    ...givenOptions,
  };

  const { environment, entry } = options;

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
          keepProcessEnv: false,
          optimizeDeps: {
            // context(justinvdm, 12 Dec 2024): Prevents `import { createRequire } from "node:module"` for pre-bundled CJS deps
            esbuildOptions: {
              platform: "browser",
              banner: undefined,
            },
          },
          build: {
            ssr: true,
            rollupOptions: {
              input: {
                index: entry,
              },
            },
          },
        },
      },
    }),
    load: async (id) => {
      // context(justinvdm, 2025-01-06): Avoid vite throwing an error for WASM modules
      // The actual loading of these modules happens in the module runner
      if (id.endsWith(".wasm")) {
        return ''
      }
    },
    hotUpdate(ctx) {
      if (!["client", environment].includes(this.environment.name)) {
        return;
      }

      // todo(justinvdm, 12 Dec 2024): Skip client references

      const modules = Array.from(
        ctx.server.environments[environment].moduleGraph.getModulesByFile(
          ctx.file,
        ) ?? [],
      );

      const isWorkerUpdate =
        ctx.file === entry ||
        modules.some(module => hasEntryAsAncestor(module, entry));

      // The worker doesnt need an update
      // => Short circuit HMR
      if (!isWorkerUpdate) {
        return [];
      }

      // The worker needs an update, but this is the client environment
      // => Notify for HMR update of any css files imported by in worker, that are also in the client module graph
      // Why: There may have been changes to css classes referenced, which might css modules to change
      if (this.environment.name === "client") {
        const cssModules = [];

        for (const [_, module] of ctx.server.environments[environment]
          .moduleGraph.idToModuleMap) {
          // todo(justinvdm, 13 Dec 2024): We check+update _all_ css files in worker module graph,
          // but it could just be a subset of css files that are actually affected, depending
          // on the importers and imports of the changed file. We should be smarter about this.
          if (module.file && module.file.endsWith(".css")) {
            const clientModules =
              ctx.server.environments.client.moduleGraph.getModulesByFile(
                module.file,
              );

            if (clientModules) {
              cssModules.push(...clientModules.values());
            }
          }
        }

        return [
          ...ctx.modules,
          ...cssModules,
        ];
      }

      // The worker needs an update, and the hot check is for the worker environment
      // => Notify for custom RSC-based HMR update, then short circuit HMR
      if (isWorkerUpdate && this.environment.name === environment) {
        const shortName = getShortName(ctx.file, ctx.server.config.root);

        this.environment.logger.info(
          `${colors.green(`worker update`)} ${colors.dim(shortName)}`,
          {
            clear: true,
            timestamp: true,
          },
        );

        const m = ctx.server.environments.client.moduleGraph
          .getModulesByFile(resolve(SRC_DIR, "app", "style.css"))
          ?.values()
          .next().value!;

        ctx.server.environments.client.moduleGraph.invalidateModule(
          m,
          new Set(),
          ctx.timestamp,
          true,
        );

        ctx.server.environments.client.hot.send({
          type: "custom",
          event: "rsc:update",
          data: {
            file: ctx.file,
          },
        });

        return [];
      }
    },
    configureServer: (server) => () => {
      server.middlewares.use(
        createServerMiddleware(
          (server.environments[environment] as unknown as { api: DevEnvApi })
            .api,
        ),
      );
    },
  };
};
