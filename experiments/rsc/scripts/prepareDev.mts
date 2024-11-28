import { buildVendorBundles } from "./buildVendorBundles.mjs";
import { codegen } from "./codegen.mjs";

export const prepareDev = async () => {
  // todo(justinvdm, 2024-11-21): Incremental builds for these steps

  codegen();
  await buildVendorBundles();
};

if (import.meta.url === new URL(process.argv[1], import.meta.url).href) {
  prepareDev();
}
