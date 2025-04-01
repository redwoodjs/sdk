import { $ } from "../lib/$.mjs";
import { readFile } from "fs/promises";
import { resolve } from "path";

export const initDev = async () => {
  console.log("Initializing development environment...");

  const pkg = JSON.parse(
    await readFile(resolve(process.cwd(), "package.json"), "utf-8"),
  );

  if (pkg.scripts?.["migrate:dev"]) {
    await $`pnpm migrate:dev`;
  }

  if (pkg.scripts?.["seed"]) {
    await $`pnpm seed`;
  }

  console.log("Done!");
  console.log();
};

if (import.meta.url === new URL(process.argv[1], import.meta.url).href) {
  initDev();
}
