#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";
import { $ as $base } from 'execa';

// todo(justinvdm, 2025-02-09): Set this only when in this monorepo
process.env.RW_DEV = "1";

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
  }
})

const [runner, containingDir, extension] = process.env.RW_DEV ? ['tsx', 'src', 'mts'] : ['node', 'dist', 'mjs']

$`${runner} ${path.resolve(ROOT_DIR, containingDir, 'scripts', SCRIPT_NAME)}.${extension} ${ARGS.slice(1).join(" ")}`;