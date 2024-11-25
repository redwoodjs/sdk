import { mergeConfig, type InlineConfig } from 'vite';
import { resolve, dirname } from 'node:path';
import { resolve as importMetaResolve } from 'import-meta-resolve'
import { createRequire } from 'node:module';

const __dirname = new URL('.', import.meta.url).pathname;

export const ROOT_DIR = resolve(__dirname, '..')
export const DIST_DIR = resolve(ROOT_DIR, 'dist')
export const RESOLVED_WORKER_PATHNAME = resolve(ROOT_DIR, 'src/worker.tsx')
export const VENDOR_DIST_DIR = resolve(ROOT_DIR, 'vendor/dist')

export const PRISMA_CLIENT_ENTRY_POINT_URL = importMetaResolve('@prisma/client', import.meta.url)
export const PRISMA_CLIENT_DIR_PATH = dirname(new URL(PRISMA_CLIENT_ENTRY_POINT_URL).pathname)
export const PRISMA_CLIENT_GENERATE_ENTRY_POINT = createRequire(PRISMA_CLIENT_ENTRY_POINT_URL).resolve('.prisma/client/default.js')
export const PRISMA_CLIENT_GENERATE_DIR = dirname(PRISMA_CLIENT_GENERATE_ENTRY_POINT)
export const PRISMA_CLIENT_ENTRY_POINT = resolve(PRISMA_CLIENT_GENERATE_DIR, 'wasm.js')
export const PRISMA_CLIENT_RUNTIME_WASM_PATH = resolve(PRISMA_CLIENT_DIR_PATH, 'runtime', 'wasm.js')
export const PRISMA_QUERY_ENGINE_WASM_PATH = resolve(PRISMA_CLIENT_GENERATE_DIR, 'query_engine_bg.wasm');

export const DEV_SERVER_PORT = 2332;
export const CLIENT_DEV_SERVER_PORT = 5173;
export const WORKER_DEV_SERVER_PORT = 5174;
export const WORKER_URL = '/src/worker.tsx';

const MODE = process.env.NODE_ENV === 'development' ? 'development' : 'production'

export const viteConfigs = {
  workerBase: (): InlineConfig => ({
    mode: MODE,
    build: {
      rollupOptions: {
        external: (filepath: string) => {
          if (filepath === '@prisma/client') {
            return true
          }
          if(filepath.endsWith('.wasm')) {
            console.log('######',filepath)
          }
          return filepath.endsWith('.wasm')
        }
      }
    },
    resolve: {
      conditions: ['workerd'],
      alias: {
        'vendor/react-ssr': resolve(VENDOR_DIST_DIR, 'react-ssr.mjs'),
        'vendor/react-rsc-worker': resolve(VENDOR_DIST_DIR, 'react-rsc-worker.mjs'),
        //'@prisma/client': PRISMA_CLIENT_PATH
      }
    }
  }),
  workerBuild: (): InlineConfig => mergeConfig(viteConfigs.workerBase(), {
    mode: MODE,
    build: {
      sourcemap: true,
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
  workerDeploymentBuild: (): InlineConfig => mergeConfig(viteConfigs.workerBuild(), {
    mode: MODE,
    build: {
      outDir: resolve(__dirname, '../dist'),
      lib: {
        entry: RESOLVED_WORKER_PATHNAME,
        name: 'worker',
        formats: ['es'],
        fileName: 'worker'
      },
    },
  }),
}