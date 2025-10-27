import { $ } from "../lib/$.mjs";
import { hasPkgScript } from "../lib/hasPkgScript.mjs";

export const initDev = async () => {
  console.log("Initializing development environment...");
  const projectRootDir = process.cwd();

  if (await hasPkgScript(projectRootDir, "generate")) {
    console.log("Generating...");
    await $("npm", ["run", "generate"]);
  }

  if (await hasPkgScript(projectRootDir, "migrate:dev")) {
    console.log("Running migrations...");
    await $("npm", ["run", "migrate:dev"]);
  }

  if (await hasPkgScript(projectRootDir, "seed")) {
    console.log("Seeding database...");
    await $("npm", ["run", "seed"]);
  }

  console.log("Done!");
  console.log();

  // todo(justinvdm, 01 Apr 2025): Investigate what handles are remaining open
  process.exit(0);
};

if (import.meta.url === new URL(process.argv[1], import.meta.url).href) {
  initDev();
}
