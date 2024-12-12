import { createServer as createViteServer } from "vite";

import { viteConfigs } from "./configs/vite.mjs";
import { codegenTypes } from "./codegenTypes.mjs";
import { $ } from "./lib/$.mjs";
import { DEV_SERVER_PORT } from "./lib/constants.mjs";

const setup = async () => {
  // context(justinvdm, 2024-12-05): Call indirectly to silence verbose output when VERBOSE is not set
  await $`npx tsx ./scripts/buildVendorBundles.mts`;

  // context(justinvdm, 2024-11-28): Types don't affect runtime, so we don't need to block the dev server on them
  void codegenTypes();
};

const runDevServer = async () => {
  const server = await createViteServer(viteConfigs.dev({ setup }));
  await server.listen();

  console.log(`\
🚀 Dev server ready!
⭐️ Local: http://localhost:${DEV_SERVER_PORT}
  `);
};

if (import.meta.url === new URL(process.argv[1], import.meta.url).href) {
  runDevServer();
}
