import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

export async function getViteEsbuild(projectRootDir: string): Promise<any> {
  const vitePath = require.resolve("vite/package.json", {
    paths: [projectRootDir],
  });
  const viteDir = path.dirname(vitePath);

  const esbuildPath = require.resolve("esbuild", { paths: [viteDir] });

  const esbuildModule = await import(esbuildPath);
  return esbuildModule.default || esbuildModule;
}
