import { createServer as createViteServer } from "vite";
import "dotenv/config";

import { viteConfigs } from "./configs/vite.mjs";
import { codegenTypes } from "./codegenTypes.mjs";
import { $ } from "./lib/$.mjs";

const setup = async () => {
  // context(justinvdm, 2024-12-05): Call indirectly to silence verbose output when VERBOSE is not set
  await $`npx tsx ./scripts/buildVendorBundles.mts`;

  // context(justinvdm, 2024-11-28): Types don't affect runtime, so we don't need to block the dev server on them
  void codegenTypes();
};

const runDevServer = async () => {
  await createViteServer(viteConfigs.dev({ setup }));
};

if (import.meta.url === new URL(process.argv[1], import.meta.url).href) {
  runDevServer();
}
