import { createBuilder } from "vite";
import { viteConfigs } from "./lib/configs.mjs";
import { buildVendorBundles } from "./buildVendorBundles.mjs";
import { findFilesContainingUseClient } from "./lib/findFilesContainingUseClient.mjs";

const main = async () => {
  await buildVendorBundles();
  const filesContainingUseClient = await findFilesContainingUseClient();

  const builder = await createBuilder(
    viteConfigs.deploy({
      filesContainingUseClient,
    }),
  );

  await builder.buildApp();
};

main();
