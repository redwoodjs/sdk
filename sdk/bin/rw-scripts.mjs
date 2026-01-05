#!/usr/bin/env node

import { execa } from "execa";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ROOT_DIR = path.resolve(__dirname, "..");
const BIN_DIR = path.resolve(ROOT_DIR, "node_modules", ".bin");

const ARGS = process.argv.slice(2);
const SCRIPT_NAME = ARGS[0];

const main = async () => {
  const scriptPath =
    path.resolve(ROOT_DIR, "dist", "scripts", SCRIPT_NAME) + ".mjs";
  const args = ARGS.slice(1);

  const result = await execa("node", [scriptPath, ...args], {
    stdio: "inherit",
    reject: false,
    env: {
      ...process.env,
      PATH: `${process.env.PATH}:${BIN_DIR}`,
    },
  });
  process.exitCode = result.exitCode;
};

main();
