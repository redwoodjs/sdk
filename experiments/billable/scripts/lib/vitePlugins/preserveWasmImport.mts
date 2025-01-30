import { pathExists } from 'fs-extra';
import { readFile } from 'fs/promises';
import path from 'path';
import { Plugin } from 'vite';

export const preserveWasmImport = (): Plugin => ({
  name: 'import-relative-wasm',
  enforce: 'pre',
  //resolveId(source) {
  //  if (source.endsWith('.wasm')) {
  //    return source;
  //  }
  //},
  async load(id) {
    if (id.endsWith('.wasm')) {
      const filePath = path.resolve(id);
      const fileName = path.basename(id);

      console.log('## load', id, await pathExists(filePath))
      if (await pathExists(filePath)) {
        const referenceId = this.emitFile({
          type: 'asset',
          fileName,
          source: await readFile(filePath),
        });
        return `import WasmModule from import.meta.ROLLUP_FILE_URL_${referenceId};; export default WasmModule;`;
      }
    }
    return null;
  }
});
