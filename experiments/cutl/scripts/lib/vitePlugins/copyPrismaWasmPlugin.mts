import { copy, pathExists } from 'fs-extra';
import MagicString from "magic-string";
import path from 'path';
import { Plugin } from 'vite';
import { createRequire } from 'module';

import { ROOT_DIR } from '../constants.mjs';

export const copyPrismaWasmPlugin = (): Plugin => ({
  name: 'copy-prisma-wasm',
  enforce: 'post',
  async writeBundle() {
    const wasmFilePath = createRequire(createRequire(import.meta.url).resolve('@prisma/client')).resolve('.prisma/client/query_engine_bg.wasm');

    const fileName = path.basename(wasmFilePath);
    const outputPath = path.resolve(ROOT_DIR, 'dist', 'worker', fileName);

    if (await pathExists(wasmFilePath)) {
      await copy(wasmFilePath, outputPath);
      console.log(`✅ Copied ${fileName} from ${wasmFilePath} to ${outputPath}`);
    } else {
      console.warn(`⚠️ WASM file not found at: ${wasmFilePath}`);
    }
  },
  renderChunk(code) {
    if (!code.includes('.wasm')) {
      return
    }

    const s = new MagicString(code);

    s.replace(/import\(["'](.+?\.wasm)["']\)/g, (_, filePath) => {
      const fileName = path.basename(filePath);
      return `import("./${fileName}")`;
    })

    return {
      code: s.toString(),
      map: s.generateMap(),
    }
  }
});
