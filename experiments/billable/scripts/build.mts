import { createBuilder } from "vite";
import { viteConfigs } from "./configs/vite.mjs";
import { $, $sh } from "./lib/$.mjs";

export const build = async () => {
  console.log("Building...");

  // context(justinvdm, 2024-12-05): Call indirectly to silence verbose output when VERBOSE is not set
  await $`pnpm build:vendor`;

  await $`pnpm prisma generate`;

  const builder = await createBuilder(
    viteConfigs.deploy(),
  );

  await builder.buildApp();

  await $sh`mkdir -p dist/assets`;
  await $sh`mv dist/{client,worker}/assets/* dist/assets/`;
  await $sh`rmdir dist/{client,worker}/assets`;

  console.log("Build done!");
  console.log();
};

if (import.meta.url === new URL(process.argv[1], import.meta.url).href) {
  build();
}
