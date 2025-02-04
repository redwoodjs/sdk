import { createServer as createViteServer } from "vite";

import { viteConfigs } from "./configs/vite.mjs";
import { codegen } from "./codegen.mjs";
import { $ } from "./lib/$.mjs";

const setup = ({ silent = false } = {}) => async () => {
  // context(justinvdm, 2024-12-05): Call indirectly to silence verbose output when VERBOSE is not set
  await $`pnpm build:vendor`;

  // context(justinvdm, 2024-11-28): Types don't affect runtime, so we don't need to block the dev server on them
  void codegen({ silent });
};

export const runDevServer = async ({ isMain = false } = {}) => {
  const silent = !isMain;

  const server = await createViteServer(viteConfigs.dev({
    setup: setup({ silent }),
    silent,
    port: 0,
    restartOnChanges: isMain,
  }));

  await server.listen();
  const address = server.httpServer?.address();

  if (!address || typeof address === 'string') {
    throw new Error('Dev server address is invalid');
  }

  if (!silent) {
    console.log(`\
🚀 Dev server ready!
⭐️ Local: http://localhost:${address.port}
  `);
  }

  return server
};

if (import.meta.url === new URL(process.argv[1], import.meta.url).href) {
  runDevServer({ isMain: true });
}
