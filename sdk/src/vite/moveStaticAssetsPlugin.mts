import fs from "fs-extra";
import path from "node:path";
import { Plugin } from "vite";

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

      if (!(await fs.pathExists(sourceDir))) {
        return;
      }

      const ssrManifestPath = path.join(
        rootDir,
        "dist",
        "worker",
        ".vite",
        "ssr-manifest.json",
      );

      if (!(await fs.pathExists(ssrManifestPath))) {
        return;
      }

      const manifestContent = await fs.readFile(ssrManifestPath, "utf-8");
      const ssrManifest: Record<string, string[]> = JSON.parse(manifestContent);

      const publicAssets = new Set<string>();

      for (const [moduleId, assetPaths] of Object.entries(ssrManifest)) {
        if (moduleId.includes("?url")) {
          for (const assetPath of assetPaths) {
            const assetFileName = path.basename(assetPath);
            publicAssets.add(assetFileName);
          }
        }
      }

      const allFiles = await fs.readdir(sourceDir);
      const filesToMove = allFiles.filter(
        (file) =>
          !file.endsWith(".js") &&
          !file.endsWith(".map") &&
          publicAssets.has(file),
      );

      if (filesToMove.length > 0) {
        await fs.ensureDir(destDir);
        for (const file of filesToMove) {
          const sourceFile = path.join(sourceDir, file);
          const destFile = path.join(destDir, file);
          await fs.move(sourceFile, destFile, { overwrite: true });
        }
      }

      await fs.remove(ssrManifestPath);
    }
  },
});
