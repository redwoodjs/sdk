import { $ } from "./lib/$.mjs";
import { log } from '../../billable/scripts/lib/log.mjs';

export const codegen = async () => {
  log("Generating types...");
  log("Generating db types...");

  await $`pnpm prisma generate`;

  log("Generating wrangler types...");
  await $`pnpm wrangler types`;

  log("Types generated!");
  log();
};

if (import.meta.url === new URL(process.argv[1], import.meta.url).href) {
  codegen();
}
