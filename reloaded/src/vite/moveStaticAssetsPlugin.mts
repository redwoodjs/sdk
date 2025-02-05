import { Plugin } from "vite";
import { $sh } from "../lib/$.mjs";

export const moveStaticAssetsPlugin = ({ rootDir }: { rootDir: string }): Plugin => ({
  name: 'rw-reloaded-move-static-assets',

  async closeBundle() {
    if (this.environment.name === 'client') {
      await $sh({ cwd: rootDir })`mv dist/client/assets/* dist/client/`;
      await $sh({ cwd: rootDir })`rmdir dist/client/assets`;
    }

    if (this.environment.name === 'worker') {
      await $sh({ cwd: rootDir })`mv dist/worker/assets/* dist/client/`;
      await $sh({ cwd: rootDir })`rmdir dist/worker/assets`;
    }
  },
});
