import { createBuilder } from "vite";
import { viteConfigs } from "./lib/configs.mjs";
import { buildVendorBundles } from "./buildVendorBundles.mjs";
import { findFilesContainingUseClient } from "./lib/findFilesContainingUseClient.mjs";

export const build = async () => {
  console.log("Building...");
  await buildVendorBundles();
  const filesContainingUseClient = await findFilesContainingUseClient();

  const builder = await createBuilder(
    viteConfigs.deploy({
      filesContainingUseClient,
    }),
  );

  await builder.buildApp();
  console.log("Build done!");
};

if (import.meta.url === new URL(process.argv[1], import.meta.url).href) {
  build();
}
