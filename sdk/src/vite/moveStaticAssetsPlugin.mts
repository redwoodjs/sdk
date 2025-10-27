import path from "node:path";
import { Plugin } from "vite";
import fs from "fs-extra";
import { glob } from "glob";

export const moveStaticAssetsPlugin = ({
  rootDir,
}: {
  rootDir: string;
}): Plugin => ({
  name: "rwsdk:move-static-assets",

  apply: "build",

  async closeBundle() {
    if (
      this.environment.name === "worker" &&
      process.env.RWSDK_BUILD_PASS === "linker"
    ) {
      const sourceDir = path.join(rootDir, "dist", "worker", "assets");
      const destDir = path.join(rootDir, "dist", "client", "assets");
      const cssFiles = await glob("*.css", { cwd: sourceDir });

      if (cssFiles.length > 0) {
        await fs.ensureDir(destDir);
        for (const file of cssFiles) {
          const sourceFile = path.join(sourceDir, file);
          const destFile = path.join(destDir, file);
          await fs.move(sourceFile, destFile, { overwrite: true });
        }
      }
    }
  },
});
