import { Plugin } from 'vite'

export const acceptWasmPlugin = (): Plugin => {
  return {
    enforce: 'pre',
    name: 'rw-sdk-accept-wasm',
    load(id: string) {
      // context(justinvdm, 2025-01-29): We need to avoid vite saying it can't load WASM modules, which would
      // happen if passed control onto the remaining plugins. Actual loading will happen in cloudflare's vite plugin
      if (id.endsWith('.wasm')) {
        return ``
      }
    }
  }
}
