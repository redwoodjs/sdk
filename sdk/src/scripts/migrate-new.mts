import snakeCase from "lodash/snakeCase.js";
import { $ } from "../lib/$.mjs";
import { readdir } from "fs/promises";
import { resolve } from "path";
import { mkdirp } from "fs-extra";

const getNextMigrationNumber = async (): Promise<string> => {
  await mkdirp(resolve(process.cwd(), "./migrations"));
  const files = await readdir(resolve(process.cwd(), "./migrations"));

  const numbers = files
    .map((file) => parseInt(file.split("_")[0]))
    .filter((num) => !isNaN(num));

  const lastNumber = Math.max(0, ...numbers);
  return String(lastNumber + 1).padStart(4, "0");
};

export const migrateNew = async (name: string, skipApply = false) => {
  if (!name) {
    console.log("Usage: pnpm migrate:new <migration-name> [--no-apply]");
    console.log('Example: pnpm migrate:new "Add user"');
    process.exit(1);
  }

  const nextNum = await getNextMigrationNumber();
  const filepath = `./migrations/${nextNum}_${snakeCase(name.toLowerCase())}.sql`;
  await $`pnpm prisma migrate diff --from-local-d1 --to-schema-datamodel ./prisma/schema.prisma --script --output ${filepath}`;

  console.log("Generated migration:", filepath);

  if (!skipApply) {
    console.log("Applying migration in development...");
    await $`pnpm migrate:dev`;
  }
};

if (import.meta.url === new URL(process.argv[1], import.meta.url).href) {
  const args = process.argv.slice(2);

  // Separate flags from other arguments
  const flags = new Set(args.filter((arg) => arg.startsWith("--")));
  const nonFlags = args.filter((arg) => !arg.startsWith("--"));

  const skipApply = flags.has("--no-apply");
  const [name] = nonFlags;

  migrateNew(name, skipApply);
}
