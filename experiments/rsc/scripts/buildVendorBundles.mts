import { resolve } from 'node:path';
import dts from 'vite-plugin-dts'
import { build, mergeConfig, type InlineConfig } from 'vite';

const __dirname = new URL('.', import.meta.url).pathname;

const DEST_DIR = resolve(__dirname, '../vendor/dist')
const SRC_DIR = resolve(__dirname, '../vendor/src')

const MODE = process.env.NODE_ENV === 'development' ? 'development' : 'production'

const configs = {
  common: (): InlineConfig => ({
    mode: MODE,
    plugins: [
      [dts({
        rollupTypes: true,
        tsconfigPath: resolve(__dirname, '../tsconfig.vendor.json'),
      })],
    ],
    build: {
      sourcemap: true,
      minify: MODE === 'production',
    }
  }),
  reactRSCWorker: (): InlineConfig => mergeConfig(configs.common(), {
    build: {
      outDir: DEST_DIR,
      lib: {
        entry: resolve(SRC_DIR, 'react-rsc-worker.ts'),
        name: 'react-rsc-worker',
        formats: ['es'],
        fileName: 'react-rsc-worker'
      },
    },
    resolve: {
      conditions: ['react-server'],
    }
  }),
  reactSSR: (): InlineConfig => mergeConfig(configs.common(), {
    build: {
      outDir: DEST_DIR,
      lib: {
        entry: resolve(SRC_DIR, 'react-ssr.ts'),
        name: 'react-ssr',
        formats: ['es'],
        fileName: 'react-ssr'
      },
    },
  }),
}

export const buildVendorBundles = async () => {
  await Promise.all([
    build(configs.reactRSCWorker()),
    build(configs.reactSSR()),
  ])
}

if (import.meta.url === new URL(process.argv[1], import.meta.url).href) {
  buildVendorBundles()
}