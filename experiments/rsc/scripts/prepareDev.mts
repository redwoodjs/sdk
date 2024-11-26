import { pathExists } from "fs-extra";
import { buildVendorBundles } from "./buildVendorBundles.mjs";
import { VENDOR_DIST_DIR } from "./configs.mjs";
import { $ } from "execa";

export const prepareDev = async () => {
  // todo(justinvdm, 2024-11-21): Incremental builds for these steps

  if (process.env.FORCE_PREPARE_DEV || !(await pathExists(VENDOR_DIST_DIR))) {
    await $`pnpm migrate:dev`;
    await $`pnpm codegen`;
    await buildVendorBundles();
  }
};

if (import.meta.url === new URL(process.argv[1], import.meta.url).href) {
  prepareDev();
}
