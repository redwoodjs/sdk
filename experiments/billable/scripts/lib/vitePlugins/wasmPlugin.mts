import fs from 'fs-extra';
import path from 'path';
import { InlineConfig, mergeConfig, type Plugin } from 'vite';
import { ROOT_DIR } from '../constants.mjs'

export const wasmPlugin = (): Plugin => {
  const collectedWasmFiles = new Set<string>(); // To collect unique `.wasm` files

  return {
    name: 'reloaded-wasm-plugin',
    config: (config: InlineConfig) => mergeConfig(config, ({
      environments: {
        worker: {
          optimizeDeps: {
            extensions: ['.wasm'],
            esbuildOptions: {
              plugins: [{
                name: 'wasm-collect-and-copy',
                setup(build) {
                  build.onResolve({ filter: /\.wasm$/ }, async (args: { path: string, resolveDir: string }) => {
                    const resolvedPath = path.resolve(args.resolveDir, args.path);
                    collectedWasmFiles.add(resolvedPath);
                    const outputDir = path.resolve(ROOT_DIR, 'node_modules/.vite/deps_worker');
                    await fs.mkdirp(outputDir);
                    const targetPath = path.join(outputDir, path.basename(resolvedPath));
                    console.log('## Copying WASM file:', resolvedPath, 'to', targetPath);
                    await fs.copy(resolvedPath, targetPath);

                    return {
                      external: true,
                    };
                  });
                },
              }],
            },
          },
        },
      },
    })),
  };
};