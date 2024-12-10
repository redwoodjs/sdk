import { readFile } from "node:fs/promises";
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
  Plugin,
  ResolvedConfig,
} from "vite";
import { dispatchNodeRequestToMiniflare } from "./requestUtils.mjs";

type UserMiniflareOptions = SharedOptions & SourcelessWorkerOptions;

interface MiniflarePluginOptions {
  environment: string;
  miniflare?: Partial<UserMiniflareOptions>;
}

interface MiniflarePluginContext {
  miniflare: Miniflare;
}

const readModule = (id: string) =>
  readFile(fileURLToPath(importMetaResolve(id, import.meta.url)), "utf8");

const createMiniflareOptions = async ({
  miniflare: userOptions = {},
}: MiniflarePluginOptions): Promise<MiniflareOptions> => {
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
  };

  return {
    ...userOptions,
    workers: [worker],
  };
};

const createDevEnv = async ({
  name,
  config,
  context,
}: {
  name: string;
  config: ResolvedConfig;
  context: MiniflarePluginContext;
}) => {
  const { miniflare } = context;

  const transport: HotChannel = {};

  class MiniflareDevEnvironment extends DevEnvironment {
    async close() {
      await super.close();
      await miniflare.dispose();
    }
  }:

  const devEnv = new MiniflareDevEnvironment(name, config, {
    hot: true,
    transport,
  });

  return devEnv;
};

const createPluginContext = async ({
  pluginOptions,
}: {
  pluginOptions: MiniflarePluginOptions;
}) => {
  const miniflare = new Miniflare(await createMiniflareOptions(pluginOptions));

  return {
    miniflare,
  };
};

const createServerMiddleware = ({ miniflare }: MiniflarePluginContext) => {
  const miniflarePluginMiddleware: Connect.NextHandleFunction = (
    request,
    response,
  ) => {
    dispatchNodeRequestToMiniflare({
      miniflare,
      request,
      response,
    });
  };

  return miniflarePluginMiddleware;
};

export const miniflarePlugin = async (
  pluginOptions: MiniflarePluginOptions,
): Promise<Plugin> => {
  const { environment } = pluginOptions;
  const pluginContext = await createPluginContext({ pluginOptions });

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
              }),
          },
        },
      },
    }),
    configureServer: (server) => () =>
      server.middlewares.use(createServerMiddleware(pluginContext)),
  };
};
