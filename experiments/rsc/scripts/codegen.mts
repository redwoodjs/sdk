import { $ } from "./lib/$.mjs";

export const codegen = async () => {
  console.log("Generating types...");
  console.log("Generating db types...");

  await $`pnpm prisma generate`;

  console.log("Generating wrangler types...");
  await $`pnpm wrangler types`;

  console.log("Types generated!");
  console.log();
};

if (import.meta.url === new URL(process.argv[1], import.meta.url).href) {
  codegen();
}
