import { Plugin } from "vite";
import { $sh } from "../lib/$.mjs";

export const moveStaticAssetsPlugin = ({
  rootDir,
}: {
  rootDir: string;
}): Plugin => ({
  name: "rwsdk:move-static-assets",

  apply: "build",

  async closeBundle() {
    if (this.environment.name === "worker") {
      await $sh({
        cwd: rootDir,
      })`mv dist/worker/assets/* dist/client/assets || true`;
      await $sh({ cwd: rootDir })`rmdir dist/worker/assets || true`;
    }
  },
});
