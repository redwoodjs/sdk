import { build, createServer as createViteServer, mergeConfig } from "vite";
import { copy, copyFileSync, copySync, pathExists } from 'fs-extra';
import { Miniflare, type RequestInit } from 'miniflare';
import type { InlineConfig, ViteDevServer } from 'vite';
import type { IncomingMessage, ServerResponse } from 'node:http';
import http from 'node:http';
import { resolve } from 'node:path';
import { unstable_DevEnv} from 'wrangler'

import { buildVendorBundles } from './buildVendorBundles.mjs';
// harryhcs - I could not get this config improt working as it was, but I did not spend any time on that 
import { config as viteConfig } from '../miniflare.config.mjs';
import { DIST_DIR, ROOT_DIR, VENDOR_DIST_DIR, viteConfigs } from './viteConfigs.mjs';
import { $ } from 'execa';

const __dirname = new URL('.', import.meta.url).pathname;

export const DEV_SERVER_PORT = 2332;
export const CLIENT_DEV_SERVER_PORT = 5173;
export const WORKER_DEV_SERVER_PORT = 5174;
export const WORKER_URL = '/src/worker.tsx';

interface DevServerContext {
  miniflare: Miniflare
  wranglerDevEnv: unstable_DevEnv
  viteWorkerDevServer: ViteDevServer
  viteClientDevServer: ViteDevServer
}

const configs = {
  clientDevServer: (): InlineConfig => ({
    server: {
      middlewareMode: true,
      port: CLIENT_DEV_SERVER_PORT,
    },
    base: "/static/",
    clearScreen: false,
    plugins: [],
  }),
  workerDevServer: ({ context }: { context: DevServerContext }): InlineConfig => mergeConfig(viteConfigs.workerBase(), {
    plugins: [workerHMRPlugin({ context })],
  }),
}

const setup = async (): Promise<DevServerContext> => {
  let context: Partial<DevServerContext> = {}
  const wranglerDevEnv = new unstable_DevEnv({})

  const viteClientDevServer = await createViteServer(configs.clientDevServer())

  const viteWorkerDevServer = await createViteServer(configs.workerDevServer({ context: context as DevServerContext }))

  const miniflare = new Miniflare({
    ...viteConfig,
    // context(justinvdm, 2024-11-21): `npx wrangler d1 migrations apply` creates a sqlite file in `.wrangler/state/v3/d1`
    d1Persist: resolve(__dirname, '../.wrangler/state/v3/d1'),
    modules: true,
    script: '',
    compatibilityFlags: ["streams_enable_constructors", "transformstream_enable_standard_constructor", "nodejs_compat"],
  });

  Object.assign(context, {
    miniflare,
    wranglerDevEnv,
    viteClientDevServer,
    viteWorkerDevServer
  })

  return context as DevServerContext
}

const createServers = async () => {
  if (process.env.FORCE_BUILD_VENDOR || !(await pathExists(VENDOR_DIST_DIR))) {
    await buildVendorBundles()
    await $`pnpm prisma generate`
  }

  const context = await setup()
  await rebuildWorkerScript(context)

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url as string, `http://${req.headers.host}`);

      if (url.pathname.startsWith('/static') || url.pathname === '/favicon.ico') {
        context.viteClientDevServer.middlewares(req, res);
      } else {
        const webRequest = nodeToWebRequest(req, url);
        // context(justinvdm, 2024-11-19): Type assertions needed because Miniflare's Request and Responses types have additional Cloudflare-specific properties
        const webResponse = await context.miniflare.dispatchFetch(webRequest.url, webRequest as RequestInit);
        await webToNodeResponse(webResponse as unknown as Response, res);
      }
    } catch (error) {
      console.error('Request handling error:', error);
      res.statusCode = 500;
      res.end('Internal Server Error');
    }
  });

  process.on('beforeExit', async () => {
    await context.miniflare.dispose();
  })

  server.listen(DEV_SERVER_PORT, () => {
    console.log(`
🚀 Dev server fired up and ready to rock! 🔥
⭐️ Local: http://localhost:${DEV_SERVER_PORT}
`)
  })
}

const rebuildWorkerScript = async (context: DevServerContext) => {
  const result = await build(viteConfigs.workerBuild())
  const { fileName: viteBundlePath } = (result as { output: { fileName: string }[] }).output[0]

  context.wranglerDevEnv.bundler.once('bundleComplete', event => console.log('###c', event))
  context.wranglerDevEnv.bundler.once('bundleStart', event => console.log('###st', event))
  context.wranglerDevEnv.bundler.once('error', event => console.log('###e', event))

  context.wranglerDevEnv.bundler.onConfigUpdate({
    type: "configUpdate",
    config: {
      entrypoint: resolve(DIST_DIR, viteBundlePath),
      directory: ROOT_DIR,
      build: {
        nodejsCompatMode: 'legacy',
        format: 'modules',
        moduleRoot: ROOT_DIR,
        moduleRules: [],
        define: {},
        additionalModules: [],
        bundle: true,
        exports: [],
        processEntrypoint: false,
      },
      legacy: {},
      dev: {
        persist: '_',
      },
    }
  })

  await new Promise((resolve, reject) => {
    context.wranglerDevEnv.bundler.once('bundleComplete', event => {
      console.log('###', event.bundle)
      context.miniflare.setOptions({
        script: undefined,
        modules: true,
        scriptPath: event.bundle.path
      });

      resolve(null)
    })

    context.wranglerDevEnv.bundler.once('error', e => {
      reject(new Error(JSON.stringify(e, null, 2)))
    })
  })
}

const nodeToWebRequest = (req: IncomingMessage, url: URL): Request => {
  return new Request(url.href, {
    method: req.method,
    headers: req.headers as HeadersInit,
    body: req.method !== 'GET' && req.method !== 'HEAD' ? req as unknown as BodyInit : undefined,
  });
};

const webToNodeResponse = async (webResponse: Response, nodeResponse: ServerResponse) => {
  // Copy status and headers
  nodeResponse.statusCode = webResponse.status;
  webResponse.headers.forEach((value, key) => {
    nodeResponse.setHeader(key, value);
  });

  // Stream the response
  if (webResponse.body) {
    const reader = webResponse.body.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        nodeResponse.write(value);
      }
    } finally {
      reader.releaseLock();
    }
  }
  nodeResponse.end();
};

// context(justinvdm, 2024-11-20): While it may seem odd to use the dev server and HMR only to do full rebuilds,
// we leverage the dev server's module graph to efficiently determine if the worker bundle needs to be
// rebuilt. This allows us to avoid unnecessary rebuilds when changes don't affect the worker.
// Still, first prize would be to not need to rebundle at all.
const workerHMRPlugin = ({ context }: { context: DevServerContext }) => ({
  name: 'worker-hmr',
  handleHotUpdate: async ({ file, server }: { file: string, server: ViteDevServer }) => {
    const module = server.moduleGraph.getModuleById(file);

    const isImportedByWorkerFile = [...(module?.importers || [])].some(
      (importer) => importer.file === WORKER_URL
    );


    if (isImportedByWorkerFile) {
      await rebuildWorkerScript(context)
    }

    // todo(justinvdm, 2024-11-19): Send RSC update to client
  },
})

createServers()