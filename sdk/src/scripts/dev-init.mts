import { $ } from "../lib/$.mjs";
import { hasPkgScript } from "../lib/hasPkgScript.mjs";

export const initDev = async () => {
  console.log("Initializing development environment...");
  const projectRootDir = process.cwd();

  const hasGenerate = await hasPkgScript(projectRootDir, "generate");
  const hasMigrateDev = await hasPkgScript(projectRootDir, "migrate:dev");
  const hasSeed = await hasPkgScript(projectRootDir, "seed");
  const needsDBCommands = hasMigrateDev || hasSeed;

  if (hasGenerate) {
    if (needsDBCommands) {
      console.log("Generating...");
    } else {
      console.log("Generating types in background...");
    }

    await $`npm run generate`;

    if (!needsDBCommands) {
      process.exit(0);
      return;
    }
  }

  if (hasMigrateDev) {
    console.log("Running migrations...");
    await $`npm run migrate:dev`;
  }

  if (hasSeed) {
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
