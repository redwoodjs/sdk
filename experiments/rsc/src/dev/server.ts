import { build, createServer as createViteServer, } from "vite";
import { Miniflare, type RequestInfo } from 'miniflare';
import type { InlineConfig, ViteDevServer } from 'vite';
import type { IncomingMessage, ServerResponse } from 'node:http';
import http from 'node:http';
import { resolve } from 'node:path';

const __dirname = new URL('.', import.meta.url).pathname;
export const RESOLVED_WORKER_PATHNAME = resolve(__dirname, '../worker.tsx')

export const DEV_SERVER_PORT = 2332;
export const CLIENT_DEV_SERVER_PORT = 5173;
export const WORKER_DEV_SERVER_PORT = 5174;
export const WORKER_URL = '/src/worker.tsx';

const configs = {
  client: () => ({
    server: {
      middlewareMode: true,
      port: CLIENT_DEV_SERVER_PORT,
    },
    base: "/static/",
    clearScreen: false,
    plugins: [],
  }),
  workerDevServer: ({ getMiniflare }: { getMiniflare: () => Miniflare }) => ({
    plugins: [workerHMRPlugin({ getMiniflare })],
  }),
  workerBuild: () => ({
    build: {
      rollupOptions: {
        input: {
          worker: RESOLVED_WORKER_PATHNAME,
        },
        preserveEntrySignatures: 'exports-only'
      },
    },
  }),
} satisfies Record<string, (...args: any) => InlineConfig>

const createServers = async () => {
  const clientDevServer = await createViteServer(configs.client())
  await createViteServer(configs.workerDevServer({ getMiniflare: () => miniflare }))

  const miniflare = new Miniflare({
    modules: true,
    script: await buildWorkerScript()
  });

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url as string, `http://${req.headers.host}`);

      if (url.pathname.startsWith('/static')) {
        clientDevServer.middlewares(req, res);
      } else {
        const webRequest = nodeToWebRequest(req, url);
        // context(justinvdm, 2024-11-19): Type assertions needed because Miniflare's Request and Responses types have additional Cloudflare-specific properties
        const webResponse = await miniflare.dispatchFetch(webRequest as unknown as RequestInfo);
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
  return new Request(url, {
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