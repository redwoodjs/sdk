import { Plugin } from "vite";

export const diagnosticAssetGraphPlugin = ({
  rootDir,
}: {
  rootDir: string;
}): Plugin => ({
  name: "rwsdk:diagnostic-asset-graph",

  apply: "build",

  async generateBundle(options, bundle) {
    if (
      this.environment.name === "worker" &&
      process.env.RWSDK_BUILD_PASS === "linker"
    ) {
      console.log("\n=== Asset Graph Diagnostic ===");
      console.log(`Total bundle entries: ${Object.keys(bundle).length}`);

      for (const [fileName, chunkOrAsset] of Object.entries(bundle)) {
        if (chunkOrAsset.type === "asset") {
          const asset = chunkOrAsset;
          console.log(`\nAsset: ${fileName}`);
          console.log(`  Type: ${asset.type}`);
          console.log(`  File name: ${asset.fileName}`);
          const sourcePreview =
            typeof asset.source === "string"
              ? asset.source.substring(0, 100)
              : `[Uint8Array: ${asset.source.length} bytes]`;
          console.log(`  Source: ${sourcePreview}...`);

          const moduleIds = Array.from(this.getModuleIds());
          const assetModules = moduleIds.filter(
            (id: string) =>
              id.includes(fileName) || id.includes(asset.fileName),
          );

          if (assetModules.length > 0) {
            console.log(
              `  Related module IDs: ${assetModules.slice(0, 5).join(", ")}`,
            );
          }

          for (const moduleId of moduleIds) {
            const moduleInfo = this.getModuleInfo(moduleId);
            if (moduleInfo) {
              const isImportedByUrl =
                moduleInfo.importers.some((importer) =>
                  importer.includes("?url"),
                ) || moduleId.includes("?url");

              if (
                isImportedByUrl ||
                moduleInfo.importers.some((importer) =>
                  importer.includes("Document.tsx"),
                )
              ) {
                console.log(`\n  Module: ${moduleId}`);
                console.log(
                  `    Importers: ${moduleInfo.importers.join(", ")}`,
                );
                console.log(`    Is imported with ?url: ${isImportedByUrl}`);
                console.log(
                  `    Is imported by Document.tsx: ${moduleInfo.importers.some((i) => i.includes("Document.tsx"))}`,
                );
              }
            }
          }
        }
      }

      console.log("\n=== End Asset Graph Diagnostic ===\n");
    }
  },
});
