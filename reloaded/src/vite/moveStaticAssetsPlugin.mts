import { Plugin } from "vite";
import { $sh } from "../lib/$.mjs";

export const moveStaticAssetsPlugin = ({ rootDir }: { rootDir: string }): Plugin => ({
  name: 'rw-reloaded-move-static-assets',
  writeBundle() {
    $sh({ cwd: rootDir })`mv dist/{client,worker}/assets/* dist/client/`;
    $sh({ cwd: rootDir })`rmdir dist/{client,worker}/assets`;
  },
});
