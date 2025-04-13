import { $ } from "../lib/$.mjs";
import { readFile, writeFile } from "fs/promises";
import { resolve } from "path";
import { basename } from "path";

export const initDev = async () => {
  console.log("Initializing development environment...");

  const pkg = JSON.parse(
    await readFile(resolve(process.cwd(), "package.json"), "utf-8"),
  );

  // Update wrangler name if needed
  const wranglerPath = resolve(process.cwd(), "wrangler.jsonc");
  const wranglerConfig = JSON.parse(await readFile(wranglerPath, "utf-8"));

  if (wranglerConfig.name === "__change_me__") {
    const dirName = basename(process.cwd());
    wranglerConfig.name = dirName;
    await writeFile(wranglerPath, JSON.stringify(wranglerConfig, null, 2));
    console.log(`Set wrangler name to ${dirName}`);
  }

  if (pkg.scripts?.["generate"]) {
    console.log("Generating...");
    await $`npm run generate`;
  }

  if (pkg.scripts?.["migrate:dev"]) {
    console.log("Running migrations...");
    await $`npm run migrate:dev`;
  }

  if (pkg.scripts?.["seed"]) {
    console.log("Seeding database...");
    await $`npm run seed`;
  }

  console.log("Done!");
  console.log();

  // todo(justinvdm, 01 Apr 2025): Investigate what handles are remaining open
  process.exit(0);
};

if (import.meta.url === new URL(process.argv[1], import.meta.url).href) {
  initDev();
}
