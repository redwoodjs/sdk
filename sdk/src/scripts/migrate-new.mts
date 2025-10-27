import { mkdirp } from "fs-extra";
import { readdir, writeFile } from "fs/promises";
import snakeCase from "lodash/snakeCase.js";
import { resolve } from "path";
import { $ } from "../lib/$.mjs";

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
    console.log("Usage: npm run migrate:new <migration-name> [--no-apply]");
    console.log("Example: npm run migrate:new add a user");
    process.exit(1);
  }

  const nextNum = await getNextMigrationNumber();
  const filepath = `./migrations/${nextNum}_${snakeCase(name.toLowerCase())}.sql`;
  const raw = await $(
    "npx",
    [
      "prisma",
      "migrate",
      "diff",
      "--from-local-d1",
      "--to-schema-datamodel",
      "./prisma/schema.prisma",
      "--script",
    ],
  );

  const cleaned = (raw.stdout ?? "")
    .toString()
    .split("\n")
    .filter(
      (line) =>
        !line.includes("_cf_METADATA") && !line.includes("_cf_metadata"),
    )
    .join("\n");

  if (!cleaned) {
    console.error("No changes to apply");
    process.exitCode = 1;
    return;
  }

  await writeFile(filepath, cleaned);

  console.log("Generated migration:", filepath);

  if (!skipApply) {
    console.log("Applying migration in development...");
    await $("npm", ["run", "migrate:dev"]);
    console.log("Generating Prisma Client");
    await $("npx", ["prisma", "generate"]);
  }
};

if (import.meta.url === new URL(process.argv[1], import.meta.url).href) {
  const args = process.argv.slice(2);

  // Separate flags from other arguments
  const flags = new Set(args.filter((arg) => arg.startsWith("--")));
  const nonFlags = args.filter((arg) => !arg.startsWith("--"));

  const skipApply = flags.has("--no-apply");
  const name = nonFlags.join("_").toLocaleLowerCase();

  migrateNew(name, skipApply);
}
