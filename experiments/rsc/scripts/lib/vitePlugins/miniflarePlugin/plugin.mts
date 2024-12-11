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
import { nodeToWebRequest, webToNodeResponse } from "./requestUtils.mjs";
import { FetchMetadata } from './types.mjs';

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
  pluginContext,
}: {
  name: string;
  config: ResolvedConfig;
  pluginContext: MiniflarePluginContext;
}) => {
  const { miniflare } = pluginContext;

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
  const miniflarePluginMiddleware: Connect.NextHandleFunction = async (
    request,
    response,
  ) => {
    const webRequest = nodeToWebRequest(request);

    webRequest.headers.set(
      'x-vite-fetch',
      JSON.stringify({ entry } satisfies FetchMetadata)
    );

    const webResponse = await miniflare.dispatchFetch(webRequest.url, webRequest);
    await webToNodeResponse(webResponse, response);
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
                pluginContext,
              }),
          },
        },
      },
    }),
    configureServer: (server) => () =>
      server.middlewares.use(createServerMiddleware(pluginContext)),
  };
};
