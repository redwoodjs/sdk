import fs from "fs-extra";
import path from "node:path";
import type { Manifest, Plugin } from "vite";

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

      const manifestPath = path.join(
        rootDir,
        "dist",
        "worker",
        ".vite",
        "manifest.json",
      );

      if (!(await fs.pathExists(manifestPath))) {
        return;
      }

      const manifestContent = await fs.readFile(manifestPath, "utf-8");
      const manifest: Manifest = JSON.parse(manifestContent);

      const publicAssets = new Set<string>();
      const processedModules = new Set<string>();

      const collectAssets = (moduleId: string) => {
        if (processedModules.has(moduleId)) {
          return;
        }
        processedModules.add(moduleId);

        const chunk = manifest[moduleId];
        if (!chunk) {
          return;
        }

        if (chunk.css) {
          for (const cssFile of chunk.css) {
            publicAssets.add(path.basename(cssFile));
          }
        }
        if (chunk.assets) {
          for (const assetFile of chunk.assets) {
            publicAssets.add(path.basename(assetFile));
          }
        }

        if (chunk.imports) {
          for (const importedId of chunk.imports) {
            collectAssets(importedId);
          }
        }
      };

      for (const [moduleId] of Object.entries(manifest)) {
        if (moduleId.includes("?url")) {
          collectAssets(moduleId);
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
    }
  },
});
