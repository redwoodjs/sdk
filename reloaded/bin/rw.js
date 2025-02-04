#!/usr/bin/env tsx

const SCRIPTS = {
  "build": "tsx ./scripts/build.mts",
  "build:vendor": "tsx ./scripts/buildVendorBundles.mts",
  "dev:init": "tsx ./scripts/firstRun.mts",
  "dev": "pnpm build:vendor && while true; do NODE_ENV=development tsx ./scripts/runDevServer.mts; [ $? -eq 0 ] || break; done",
  "seed": "tsx ./scripts/runWorkerScript.mts ./src/scripts/seed.ts",
  "migrate:dev": "wrangler d1 migrations apply DB --local",
  "migrate:prd": "wrangler d1 migrations apply DB --remote",
  "migrate:new": "tsx ./scripts/migrateNew.mts",
  "worker:run": "tsx ./scripts/runWorkerScript.mts",
  "codegen": "tsx ./scripts/codegen.mts",
  "types": "rw codegen:types && tsc",
  "clean": "rw clean:vite && rw clean:vendor",
  "clean:vite": "rm -rf ./node_modules/.vite",
  "clean:vendor": "rm -rf ./vendor/dist",
  "cf:deploy": "rw build && wrangler deploy",
  "format": "prettier --write ./src ./scripts"
}

const args = process.argv.slice(2);
const scriptName = args[0];

if (!scriptName || !SCRIPTS[scriptName]) {
  console.error(`Unknown script: ${scriptName}`);
  process.exit(1);
}

const script = SCRIPTS[scriptName];

$`${script} ${args.slice(1).join(" ")}`;