import { $ } from "../lib/$.mjs";

export const codegen = async ({ silent = false }: { silent?: boolean } = {}) => {
  const log = silent ? () => { } : console.log;

  console.log('Generating prisma client...')
  await $`pnpm prisma generate`;

  console.log('Generating wrangler types...')
  await $`pnpm wrangler types`;

  if (import.meta.url === new URL(process.argv[1], import.meta.url).href) {
    codegen();
  }
