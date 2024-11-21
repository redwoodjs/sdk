import { build, createServer as createViteServer, mergeConfig } from "vite";
import { pathExists } from 'fs-extra';
import { Miniflare, type RequestInit } from 'miniflare';
import type { InlineConfig, ViteDevServer } from 'vite';
import type { IncomingMessage, ServerResponse } from 'node:http';
import http from 'node:http';
import { resolve } from 'node:path';

import { buildVendorBundles } from './buildVendorBundles.mjs';
import { config as miniflareConfig } from '../miniflare.config';

const __dirname = new URL('.', import.meta.url).pathname;
export const RESOLVED_WORKER_PATHNAME = resolve(__dirname, '../src/worker.tsx')
export const VENDOR_DIST_DIR = resolve(__dirname, '../vendor/dist')

export const DEV_SERVER_PORT = 2332;
export const CLIENT_DEV_SERVER_PORT = 5173;
export const WORKER_DEV_SERVER_PORT = 5174;
export const WORKER_URL = '/src/worker.tsx';

const configs = {
  client: (): InlineConfig => ({
    server: {
      middlewareMode: true,
      port: CLIENT_DEV_SERVER_PORT,
    },
    base: "/static/",
    clearScreen: false,
    plugins: [],
  }),
  workerBase: (): InlineConfig => ({
    resolve: {
      alias: {
        'vendor/react-ssr': resolve(VENDOR_DIST_DIR, 'react-ssr.mjs'),
        'vendor/react-rsc-worker': resolve(VENDOR_DIST_DIR, 'react-rsc-worker.mjs'),
      }
    }
  }),
  workerDevServer: ({ getMiniflare }: { getMiniflare: () => Miniflare }): InlineConfig => mergeConfig(configs.workerBase(), {
    plugins: [workerHMRPlugin({ getMiniflare })],
  }),
  workerBuild: (): InlineConfig => mergeConfig(configs.workerBase(), {
    build: {
      sourcemap: 'inline',
      rollupOptions: {
        input: {
          worker: RESOLVED_WORKER_PATHNAME,
        },
        preserveEntrySignatures: 'exports-only'
      },

      // todo(justinvdm, 2024-11-21): Figure out what is making our bundle so large. React SSR and SRC bundles account for ~1.5MB.
      // todo(justinvdm, 2024-11-21): Figure out if we can do some kind of code-splitting with Miniflare
      chunkSizeWarningLimit: 4_000,
    },
  }),
}

const createServers = async () => {
  if (process.env.FORCE_BUILD_VENDOR || !(await pathExists(VENDOR_DIST_DIR))) {
    await buildVendorBundles()
  }

  const clientDevServer = await createViteServer(configs.client())
  await createViteServer(configs.workerDevServer({ getMiniflare: () => miniflare }))

  const miniflare = new Miniflare({
    ...miniflareConfig,
    modules: true,
    script: await buildWorkerScript(),
    compatibilityFlags: ["streams_enable_constructors", "transformstream_enable_standard_constructor"],
  });

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url as string, `http://${req.headers.host}`);

      if (url.pathname.startsWith('/static') || url.pathname === '/favicon.ico') {
        clientDevServer.middlewares(req, res);
      } else {
        const webRequest = nodeToWebRequest(req, url);
        // context(justinvdm, 2024-11-19): Type assertions needed because Miniflare's Request and Responses types have additional Cloudflare-specific properties
        const webResponse = await miniflare.dispatchFetch(webRequest.url, webRequest as RequestInit);
        await webToNodeResponse(webResponse as unknown as Response, res);
      }
    } catch (error) {
      console.error('Request handling error:', error);
      res.statusCode = 500;
      res.end('Internal Server Error');
    }
  });

  process.on('beforeExit', async () => {
    await miniflare.dispose();
  })

  server.listen(DEV_SERVER_PORT, () => {
    console.log(`
🚀 Dev server fired up and ready to rock! 🔥
⭐️ Local: http://localhost:${DEV_SERVER_PORT}
`)
  })
}

const buildWorkerScript = async () => {
  const result = await build(configs.workerBuild())
  return (result as { output: { code: string }[] }).output[0].code
}

// context(justinvdm, 2024-11-20): While it may seem odd to use the dev server and HMR only to do full rebuilds,
// we leverage the dev server's module graph to efficiently determine if the worker bundle needs to be
// rebuilt. This allows us to avoid unnecessary rebuilds when changes don't affect the worker.
// Still, first prize would be to not need to rebundle at all.
const workerHMRPlugin = ({ getMiniflare }: { getMiniflare: () => Miniflare }) => ({
  name: 'worker-hmr',
  handleHotUpdate: async ({ file, server }: { file: string, server: ViteDevServer }) => {
    const module = server.moduleGraph.getModuleById(file);

    const isImportedByWorkerFile = [...(module?.importers || [])].some(
      (importer) => importer.file === WORKER_URL
    );


    if (isImportedByWorkerFile) {
      const script = await buildWorkerScript();
      getMiniflare().setOptions({ script });
    }

    // todo(justinvdm, 2024-11-19): Send RSC update to client
  },
})

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


createServers()