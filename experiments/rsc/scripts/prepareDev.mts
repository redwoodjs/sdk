import { pathExists } from "fs-extra";
import { buildVendorBundles } from "./buildVendorBundles.mjs";
import { $ } from "execa";
import { D1_PERSIST_PATH, VENDOR_DIST_DIR } from "./lib/constants.mjs";

export const prepareDev = async () => {
  // todo(justinvdm, 2024-11-21): Incremental builds for these steps

  if (process.env.FORCE_PREPARE_DEV || !pathExists(D1_PERSIST_PATH)) {
    await $`pnpm migrate:dev`;
    await $`pnpm codegen`;
  }

  if (process.env.FORCE_PREPARE_DEV || !(await pathExists(VENDOR_DIST_DIR))) {
    await buildVendorBundles();
  }
};

if (import.meta.url === new URL(process.argv[1], import.meta.url).href) {
  prepareDev();
}
