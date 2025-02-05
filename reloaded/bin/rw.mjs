#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";
import { $ as $base } from 'execa';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ROOT_DIR = path.resolve(__dirname, "..");
const SCRIPTS_DIR = path.resolve(ROOT_DIR, "dist", "scripts");
const BIN_DIR = path.resolve(ROOT_DIR, "node_modules", ".bin");

const ARGS = process.argv.slice(2);
const SCRIPT_NAME = ARGS[0];

const SCRIPTS = {
  "build": 'vite build',
  "dev:init": `node ${SCRIPTS_DIR}/firstRun.mts`,
  "dev": `while true; do NODE_ENV=development vite dev; [ $? -eq 0 ] || break; done`,
  "seed": `node ${SCRIPTS_DIR}/runWorkerScript.mts ./src/scripts/seed.ts`,
  "migrate:dev": "wrangler d1 migrations apply DB --local",
  "migrate:prd": "wrangler d1 migrations apply DB --remote",
  "migrate:new": `node ${SCRIPTS_DIR}/migrateNew.mts`,
  "worker:run": `node ${SCRIPTS_DIR}/runWorkerScript.mts`,
  "codegen": `node ${SCRIPTS_DIR}/codegen.mts`,
  "types": "rw codegen:types && tsc",
  "clean": "rw clean:vite && rw clean:vendor",
  "clean:vite": "rm -rf ./node_modules/.vite",
  "clean:vendor": "rm -rf ./vendor/dist",
  "cf:deploy": "rw build && wrangler deploy",
  "format": "prettier --write ./src"
}

const $ = $base({
  shell: true,
  stdio: "inherit",
  reject: false,
  env: {
    PATH: `${process.env.PATH}:${BIN_DIR}`,
  }
})

const $internal = $base({
  shell: true,
  stdio: 'inherit',
  cwd: ROOT_DIR,
})

if (!SCRIPT_NAME) {
  console.error("No script name provided");
  process.exitCode = 1;
} else if (!SCRIPTS[SCRIPT_NAME]) {
  console.error(`Unknown script: ${SCRIPT_NAME}`);
  process.exitCode = 1;
} else {
  if (process.env.RW_DEV) {
    await $internal`pnpm build`
  }
  const script = SCRIPTS[SCRIPT_NAME];
  $`${script} ${ARGS.slice(1).join(" ")}`;
}
