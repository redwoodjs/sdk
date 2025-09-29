#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";
import { $ as $base } from "execa";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ROOT_DIR = path.resolve(__dirname, "..");
const BIN_DIR = path.resolve(ROOT_DIR, "node_modules", ".bin");

const ARGS = process.argv.slice(2);
const SCRIPT_NAME = ARGS[0];

if (SCRIPT_NAME === "addon") {
  const fs = await import("node:fs/promises");
  const addonName = ARGS[1];
  if (!addonName) {
    console.error("Please provide an addon name.");
    process.exit(1);
  }
  try {
    const readmePath = path.resolve(ROOT_DIR, "addons", addonName, "README.md");
    const readmeContent = await fs.readFile(readmePath, "utf-8");
    console.log(`
NOTE: The following instructions are for the addon's README.md, located inside your project's node_modules.
You will need to adjust file paths accordingly. For example, a command like 'cp -R src/passkey ../../src/' should be
interpreted as copying the 'src/passkey' directory from 'node_modules/rwsdk/addons/passkey/' into your project's 'src/' directory.
---
`);
    console.log(readmeContent);
    process.exit(0);
  } catch (e) {
    console.error(`Could not find README.md for addon "${addonName}".`);
    process.exit(1);
  }
}

const $ = $base({
  shell: true,
  stdio: "inherit",
  reject: false,
  env: {
    PATH: `${process.env.PATH}:${BIN_DIR}`,
  },
});

const main = async () => {
  const result =
    await $`node ${path.resolve(ROOT_DIR, "dist", "scripts", SCRIPT_NAME)}.mjs ${ARGS.slice(1).join(" ")}`;

  process.exitCode = result.exitCode;
};

main();
