import { build } from "vite";
import { viteConfigs } from "./lib/configs.mjs";
import { buildVendorBundles } from "./buildVendorBundles.mjs";

const main = async () => {
  await buildVendorBundles();
  await build(viteConfigs.deploy());
};

main();
