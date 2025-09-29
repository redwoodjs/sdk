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
    const packageJsonPath = path.resolve(ROOT_DIR, "package.json");
    const packageJsonContent = await fs.readFile(packageJsonPath, "utf-8");
    const { version } = JSON.parse(packageJsonContent);

    const url = `https://github.com/redwoodjs/sdk/blob/v${version}/sdk/addons/${addonName}/README.md`;

    console.log(
      `Find the instructions for the "${addonName}" addon for your installed version (${version}) at the following URL:`,
    );
    console.log(url);
    process.exit(0);
  } catch (e) {
    console.error(`Could not generate URL for addon "${addonName}".`);
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
