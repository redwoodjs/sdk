# GreenKeeper Role Instructions (Redwood SDK)

This is a project-level override. It extends the generic GreenKeeper role with Redwood SDK-specific context.

## Purpose

Performs dependency maintenance for the Redwood SDK monorepo. This is a **library project** -- the SDK is published to npm and consumed by users. Dependency changes here affect consumers, so updates require consumer impact awareness.

## Project Structure

This is a pnpm workspace monorepo:

| Directory | Description | Dependency Sensitivity |
|-----------|-------------|----------------------|
| `sdk/` | Core SDK package (published to npm as `rwsdk`) | High -- direct consumer impact |
| `starter/` | Template project for `create-rwsdk` | High -- ships to users |
| `addons/` | SDK addon packages | High -- published |
| `playground/` | Official E2E test projects | Medium -- internal |
| `community/` | Community showcases | Low -- internal |
| `docs/` | Documentation site | Low -- internal |
| Root | Monorepo tooling, CI config | Low -- internal |

## Dependency Tiers

Updates are organized into three tiers based on scope and risk. When running on a schedule, determine which tiers to include based on the task description or the current date:

### Tier 1: Critical Dependencies (highest priority, always included)

These are the shared infrastructure that spans the entire monorepo:

- `react`, `react-dom`, `react-server-dom-webpack`
- `@types/react`, `@types/react-dom`
- `@cloudflare/vite-plugin`, `@cloudflare/workers-types`
- `wrangler`
- `vite`

These packages appear as `peerDependencies` in the SDK and are used across the entire workspace. Update them repo-wide in a single pass to keep manifests and lockfile consistent.

### Tier 2: SDK, Addons, and Starter

All other dependencies in `sdk/package.json`, `addons/**/package.json`, and `starter/package.json` (excluding Tier 1 packages).

### Tier 3: Infrastructure, Playgrounds, and Community

Everything not covered by Tier 1 or Tier 2: root `package.json`, `playground/*/package.json`, `community/*/package.json`, `docs/package.json`, and any other workspace packages.

## SDK-Specific Patterns

### Manifest-First Updates

Always edit `package.json` files to bump version ranges. Do not rely on `pnpm update` alone -- it may only update the lockfile without changing declared ranges. The declared range is what consumers see.

For version ranges:
- `~X.Y.Z` (tilde): allows patch updates. Tighten the lower bound to exclude vulnerable versions when needed.
- `^X.Y.Z` (caret): allows minor updates. Preferred for most dependencies.

### @types/node Alignment

All packages in the monorepo must use compatible `@types/node` versions. Different versions break TypeScript plugin type identity across packages. When updating `@types/node`, update it in ALL workspace `package.json` files simultaneously.

### Playground workspace:* Pattern

Playground packages should use `workspace:*` for the `rwsdk` dependency. This brings them under pnpm workspace management so pnpm overrides from root `package.json` apply to them. If a playground pins a published SDK version instead of `workspace:*`, overrides do not reach it.

Check for this during the audit phase. If any playground uses a pinned published version, switch it to `workspace:*` as part of the update.

### pnpm Override Patterns

For transitive vulnerabilities, add entries to `pnpm.overrides` in root `package.json`:

```jsonc
// Blanket override -- forces ALL instances to a specific version
"hono": "4.12.7"

// Version-specific override -- only overrides a specific resolved version
"undici@7.18.2": "7.24.0"
```

Prefer version-specific overrides when possible. Check if existing overrides themselves have become vulnerable -- update in-place rather than adding duplicates.

### Known Limitations

- **webpack peer dep**: webpack enters via `react-server-dom-webpack` as an auto-installed peer dependency. pnpm overrides do not affect auto-installed peers. Document any webpack advisories as N/A with this explanation.
- **pnpm overrides are workspace-local**: They do not propagate to consumers. For the SDK (a library), the declared semver range in `sdk/package.json` is what matters for consumer security.

### npm Lockfiles in Workspace

If any workspace package has its own `package-lock.json` (npm), pnpm overrides from root do not reach it. Either add npm `overrides` to that package's `package.json`, or switch it to `workspace:*` to bring it under pnpm management.

## Consumer Impact Audit

This is a library project. When dependencies change in `sdk/package.json` or `addons/*/package.json`, perform a consumer impact audit:

For each updated package in the library dependency tree:
1. Is it a direct or transitive dependency of the published SDK?
2. Does the declared semver range resolve to the updated version on a fresh `npm install` / `pnpm add rwsdk`?
3. Could a consumer's existing lockfile pin them to an older (possibly vulnerable) version?

Include the consumer impact assessment in the completion report (not in the PR -- the PR stays neutral).

## PR Framing

Follow the generic GreenKeeper PR framing rules. All PRs are routine dependency updates. No security language, no CVE references, no "Am I affected?" sections.

PR title format: `chore(deps): update dependencies`

### Advisory Draft

When advisories are resolved, write a communication-ready draft to `.notes/advisory-drafts/`. This file is for manual review and Discord posting -- it does not appear in the PR diff or description.

The advisory draft follows the SecurityAdvisor's canonical format:
- What the vulnerability is (plain language)
- Who is NOT affected
- Who might be affected, with safe/unsafe code examples
- Upgrade instructions (lockfile-only path first)
- Links to upstream advisories

## Verification

After applying all updates:
1. Run `pnpm install` -- verify no resolution errors
2. Run `pnpm audit` -- verify advisory count decreased or reached zero
3. Run the SDK build: `pnpm --filter rwsdk build`
4. Run SDK unit tests: `cd sdk && pnpm test`
5. If snapshot tests fail due to version bumps, regenerate with `pnpm test -- -u`

Smoke tests and E2E tests run in CI -- do not run them locally. Document any expected CI considerations in the PR description.
