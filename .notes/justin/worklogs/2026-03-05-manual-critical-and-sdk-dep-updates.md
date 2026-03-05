# 2026-03-05 Manual Critical and SDK/Starter Dependency Updates

## Task Narrative
We are manually updating dependencies that fall into two Renovate schedule groups:
1. **Critical Dependencies**: react, react-dom, react-server-dom-webpack, @types/react, @types/react-dom, @cloudflare/vite-plugin, @cloudflare/workers-types, wrangler, vite
2. **SDK & Starter Dependencies**: all other deps in sdk/package.json, addons/**, and starter/package.json (excluding critical deps)

We skip the Infrastructure/Playgrounds group (3rd rule in renovate.json) since we are releasing soon and want to focus on what matters.

## Synthesized Context
- Renovate rangeStrategy is "bump" - this means we bump the version in the manifest to the latest matching the range
- For pinned versions (no range prefix), we update to the latest
- For tilde (~) ranges, we bump to latest within the range constraint
- The ignoreUnstable flag is set for critical deps, meaning we skip pre-release versions for those
- Files in scope: sdk/package.json, starter/package.json, addons/passkey/package.json

## Approach
We will use `pnpm outdated` and `npm view` to check latest versions, then update package.json files accordingly, and run `pnpm install` to update the lockfile.

## Changes Made

### Critical Dependencies (updated across sdk, starter, addons/passkey)
- @cloudflare/vite-plugin: 1.25.1 -> 1.26.0 (also peer dep ^1.25.1 -> ^1.26.0)
- @cloudflare/workers-types: ~4.20260218.0 -> ~4.20260305.1 (pinned versions in starter/addons also updated)
- wrangler: 4.66.0 -> 4.70.0 (also peer dep ^4.66.0 -> ^4.70.0)
- react, react-dom, react-server-dom-webpack, @types/react, @types/react-dom, vite: already at latest

### SDK Dependencies (sdk/package.json)
- @ast-grep/napi: ~0.39.0 -> ~0.41.0
- @puppeteer/browsers: ~2.10.0 -> ~2.13.0
- @types/glob: ^8.1.0 -> ^9.0.0
- @types/react-is: ~19.0.0 -> ~19.2.0
- @vitejs/plugin-react: ~5.0.0 -> ~5.1.4
- chokidar: ~4.0.0 -> ~5.0.0
- debug: ~4.4.0 -> ~4.4.3
- enhanced-resolve: ~5.18.1 -> ~5.20.0
- eventsource-parser: ~3.0.0 -> ~3.0.6
- execa: ~9.6.0 -> ~9.6.1
- fs-extra: ~11.3.0 -> ~11.3.4
- glob: ~11.1.0 -> ~13.0.6
- ignore: ~7.0.4 -> ~7.0.5
- kysely: ~0.28.2 -> ~0.28.11
- magic-string: ~0.30.17 -> ~0.30.21
- puppeteer-core: ~24.22.0 -> ~24.38.0
- react-is: ~19.1.0 -> ~19.2.4
- rsc-html-stream: ~0.0.6 -> ~0.0.7
- ts-morph: ~27.0.0 -> ~27.0.2
- vibe-rules: ~0.3.0 -> ~0.3.91
- vite-tsconfig-paths: ~5.1.4 -> ~6.1.1
- capnweb (peer+dev): ~0.2.0 -> ~0.5.0

### SDK DevDependencies
- @types/lodash: ~4.17.16 -> ~4.17.24
- @types/node: ~24.10.0 -> ~25.3.3
- semver: ~7.7.1 -> ~7.7.4
- typescript: ~5.9.0 -> ~5.9.3
- vitest: ~3.2.0 -> ~4.0.18

### Starter DevDependencies
- @types/node: ~24.10.0 -> ~25.3.3

### Addons (passkey)
- @simplewebauthn/server: 13.2.2 -> 13.2.3

## Verification
- pnpm install: succeeded (lockfile updated)
- pnpm build:sdk: succeeded (clean build)
- pnpm typecheck:starter: succeeded
- pnpm typecheck:addons: succeeded
