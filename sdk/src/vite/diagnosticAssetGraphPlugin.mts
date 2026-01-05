import { Plugin } from "vite";

export const diagnosticAssetGraphPlugin = ({
  rootDir,
}: {
  rootDir: string;
}): Plugin => ({
  name: "rwsdk:diagnostic-asset-graph",

  apply: "build",

  async buildEnd() {
    if (
      this.environment.name === "worker" &&
      process.env.RWSDK_BUILD_PASS === "worker"
    ) {
      console.log("\n=== Asset Graph Diagnostic ===");

      const moduleIds = Array.from(this.getModuleIds());
      console.log(`Total modules: ${moduleIds.length}`);

      const urlImportedModules = new Set<string>();
      const publicAssets = new Set<string>();

      for (const moduleId of moduleIds) {
        const moduleInfo = this.getModuleInfo(moduleId);
        if (moduleInfo) {
          const isImportedByUrl =
            moduleInfo.importers.some((importer) =>
              importer.includes("?url"),
            ) || moduleId.includes("?url");

          if (isImportedByUrl) {
            urlImportedModules.add(moduleId);
            console.log(`\nModule imported with ?url: ${moduleId}`);
            console.log(`  Importers: ${moduleInfo.importers.join(", ")}`);

            if (moduleInfo.importedIds) {
              console.log(`  Imports: ${moduleInfo.importedIds.join(", ")}`);
              for (const importedId of moduleInfo.importedIds) {
                publicAssets.add(importedId);
              }
            }
          }

          if (
            moduleInfo.importers.some((importer) =>
              importer.includes("Document.tsx"),
            )
          ) {
            console.log(`\nModule imported by Document.tsx: ${moduleId}`);
            console.log(`  Importers: ${moduleInfo.importers.join(", ")}`);
            if (moduleInfo.importedIds) {
              console.log(`  Imports: ${moduleInfo.importedIds.join(", ")}`);
            }
          }
        }
      }

      console.log(
        `\nTotal modules imported with ?url: ${urlImportedModules.size}`,
      );
      console.log(`Total transitive dependencies: ${publicAssets.size}`);

      console.log("\n=== End Asset Graph Diagnostic ===\n");
    }
  },
});
