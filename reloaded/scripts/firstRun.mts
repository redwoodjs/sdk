import { $ } from "./lib/$.mjs";

export const initDev = async () => {
  console.log("Initializing development environment...");

  // context(justinvdm, 2024-12-05): Call indirectly to silence verbose output when VERBOSE is not set
  await $`pnpm migrate:dev`;
  await $`pnpm dlx prisma generate`;
  await $`pnpm build`;
  await $`pnpm seed`;

  console.log("Done.");
  console.log("Run `pnpm dev` to get started...")
  console.log();
};

if (import.meta.url === new URL(process.argv[1], import.meta.url).href) {
  initDev();
}
