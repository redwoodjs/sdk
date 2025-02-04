#!/usr/bin/env tsx

import path from "node:path";
import { fileURLToPath } from "node:url";
import { $sh as baseSh} from "../scripts/lib/$.mjs";
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ROOT_DIR = path.resolve(__dirname, "..");
const SCRIPTS_DIR = path.resolve(ROOT_DIR, "scripts");
const BIN_DIR = path.resolve(ROOT_DIR, "node_modules", ".bin");

const $ = baseSh({
  stdio: "inherit",
  reject: false,
  env: {
    BIN: `${process.env.BIN}:${BIN_DIR}`,
  }
})

const SCRIPTS = {
  "build": `tsx ${SCRIPTS_DIR}/build.mts`,
  "build:vendor": `tsx ${SCRIPTS_DIR}/buildVendorBundles.mts`,
  "dev:init": `tsx ${SCRIPTS_DIR}/firstRun.mts`,
  "dev": `while true; do NODE_ENV=development vite dev; [ $? -eq 0 ] || break; done`,
  "seed": `tsx ${SCRIPTS_DIR}/runWorkerScript.mts ./src/scripts/seed.ts`,
  "migrate:dev": "wrangler d1 migrations apply DB --local",
  "migrate:prd": "wrangler d1 migrations apply DB --remote",
  "migrate:new": `tsx ${SCRIPTS_DIR}/migrateNew.mts`,
  "worker:run": `tsx ${SCRIPTS_DIR}/runWorkerScript.mts`,
  "codegen": `tsx ${SCRIPTS_DIR}/codegen.mts`,
  "types": "rw codegen:types && tsc",
  "clean": "rw clean:vite && rw clean:vendor",
  "clean:vite": "rm -rf ./node_modules/.vite",
  "clean:vendor": "rm -rf ./vendor/dist",
  "cf:deploy": "rw build && wrangler deploy",
  "format": "prettier --write ./src"
}


const args = process.argv.slice(2);
const scriptName = args[0];

if (!scriptName) {
  console.error("No script name provided");
  process.exitCode = 1;
} else if (!SCRIPTS[scriptName]) {
  console.error(`Unknown script: ${scriptName}`);
  process.exitCode = 1;
} else {
  const script = SCRIPTS[scriptName];
  $`${script} ${args.slice(1).join(" ")}`;
}
