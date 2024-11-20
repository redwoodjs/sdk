import { build, createServer as createViteServer, } from "vite";
import { Miniflare, type RequestInit } from 'miniflare';
import type { InlineConfig, Plugin, ViteDevServer } from 'vite';
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
      conditions: ['react-server'],
      alias: {
        // todo(justinvdm, 2024-11-20): Use node modules resolution instead of absolute path
        // context(justinvdm, 2024-11-20): This is a hack to get around the fact that
        // react-dom has a package.json#exports with a react-server condition causing it to
        // prevent us from importing the edge version of server. In our case, we do in fact
        // want to import the edge version of react-dom in addition to react-server-dom-webpack's
        // RSC analogous renderToReadableStream, since we convert from the RSC payload to HTML.
        'react-dom/server.edge': resolve(__dirname, '../../node_modules/react-dom/server.edge.js'),
      }
    }
  }),
  workerDevServer: ({ getMiniflare }: { getMiniflare: () => Miniflare }): InlineConfig => ({
    ...configs.workerBase(),
    plugins: [workerHMRPlugin({ getMiniflare })],
  }),
  workerBuild: (): InlineConfig => ({
    ...configs.workerBase(),
    plugins: [createPatchPlugin()],
    optimizeDeps: {
      include: [
        "react",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "react-server-dom-webpack/server.edge",
      ],
    },
    build: {
      sourcemap: 'inline',
      rollupOptions: {
        input: {
          worker: RESOLVED_WORKER_PATHNAME,
        },
        preserveEntrySignatures: 'exports-only'
      },
    },
  }),
}

const createServers = async () => {
  const clientDevServer = await createViteServer(configs.client())
  await createViteServer(configs.workerDevServer({ getMiniflare: () => miniflare }))

  const miniflare = new Miniflare({
    modules: true,
    script: await buildWorkerScript(),
    compatibilityFlags: ['streams_enable_constructors'],
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

const createPatchPlugin = (): Plugin => ({
  name: "patch-react-server-dom-webpack",
  transform(code, id, _options) {
    if (id.includes("react-server-dom-webpack")) {
      // rename webpack markers in react server runtime
      // to avoid conflict with ssr runtime which shares same globals
      code = code.replaceAll(
        "__webpack_require__",
        "__vite_react_server_webpack_require__",
      );
      code = code.replaceAll(
        "__webpack_chunk_load__",
        "__vite_react_server_webpack_chunk_load__",
      );

      // make server reference async for simplicity (stale chunkCache, etc...)
      // see TODO in https://github.com/facebook/react/blob/33a32441e991e126e5e874f831bd3afc237a3ecf/packages/react-server-dom-webpack/src/ReactFlightClientConfigBundlerWebpack.js#L131-L132
      code = code.replaceAll("if (isAsyncImport(metadata))", "if (true)");
      code = code.replaceAll("4 === metadata.length", "true");

      return { code, map: null };
    }
    return;
  },
});

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