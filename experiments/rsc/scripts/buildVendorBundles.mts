import { resolve } from 'node:path';
import { build, type InlineConfig } from 'vite';

const __dirname = new URL('.', import.meta.url).pathname;

const destDir = resolve(__dirname, '../dist/vendor')

const configs = {
  reactRSCWorker: (): InlineConfig => ({
    build: {
      outDir: resolve(destDir, 'react-rsc-worker'),
      rollupOptions: {
        preserveEntrySignatures: 'exports-only'
      }
    },
    resolve: {
      conditions: ['react-server'],
    }
  }),
  reactSSR: (): InlineConfig => ({
    build: {
      outDir: resolve(destDir, 'react-ssr'),
      rollupOptions: {
        preserveEntrySignatures: 'exports-only'
      }
    },
  }),
}

export const buildVendorBundles = async () => {
  await Promise.all([
    build(configs.reactRSCWorker()),
    build(configs.reactSSR()),
  ])
}