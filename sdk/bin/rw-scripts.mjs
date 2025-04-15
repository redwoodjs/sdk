#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";
import { $ as $base } from "execa";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ROOT_DIR = path.resolve(__dirname, "..");
const BIN_DIR = path.resolve(ROOT_DIR, "node_modules", ".bin");

const ARGS = process.argv.slice(2);
const SCRIPT_NAME = ARGS[0];

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
