# Dependency Audit Report — April 15, 2026

**Monorepo**: Redwood SDK (rw-sdk-monorepo)
**Audit date**: 2026-04-15 (Week 2 — Tier 1 + Tier 3)
**pnpm version**: 10.33.0
**PR**: https://github.com/redwoodjs/sdk/pull/1148
**Node version**: v22.22.2 (engine requires >=24.14.0 — currently unmet, install will proceed)

---

## Executive Summary

Tier 1 (Critical) packages are outdated across all 33+ workspace packages that ship Tier 1 devDependencies. The root `pnpm.overrides` already force the latest resolved versions at install time, but the manifest files themselves are stale. Tier 3 packages (root dev deps, docs deps) also have available updates. No npm lockfiles were found that would bypass pnpm overrides.

---

## 1. Available Updates

### Tier 1 — Critical (Always included)

| Package | Current | Latest | Packages affected |
|---|---|---|---|
| `@cloudflare/vite-plugin` | 1.30.1 / 1.31.0 | 1.32.3 | All 31 playground pkgs + community + docs + starter + SDK devDeps |
| `@cloudflare/workers-types` | 4.20260331.1 / 4.20260405.1 | 4.20260415.1 | All 31 playground pkgs + community (devDeps) + docs + SDK |
| `vite` | 7.3.2 | 8.0.8 | All playground pkgs + community + docs + starter + SDK devDeps |
| `wrangler` | 4.79.0 / 4.80.0 / 4.77.0 | 4.83.0 | All playground pkgs + community + docs + starter |
| `react` | 19.2.5 | 19.2.5 | All packages — already latest |
| `react-dom` | 19.2.5 | 19.2.5 | All packages — already latest |
| `react-server-dom-webpack` | 19.2.5 | 19.2.5 | All packages — already latest |
| `@types/react` | 19.2.14 | 19.2.14 | Playground pkgs — already latest |
| `@types/react-dom` | 19.2.3 | 19.2.3 | Playground pkgs — already latest |

**Note**: `@types/react` is NOT a direct dependency of the SDK package itself (only in peerDependencies). The SDK depends on `@types/react@~19.2.14` (types only). Playground packages pin exact versions.

**Notable**: `vite` has a major version bump (7.3.2 → 8.0.8). This will be included per `pnpm outdated` recommendation. The peerDependency in SDK (`"vite": "^6.2.6 || 7.x"`) does NOT include vite 8, but pnpm will install 8.0.8 since the semver range is loose. Risk: medium. SDK build verification will confirm.

### Tier 3 — Infra / Playgrounds (Root + docs + playgrounds + community)

#### Root `package.json` devDependencies (Tier 3)

| Package | Current | Latest | Priority |
|---|---|---|---|
| `prettier` | 3.8.1 | 3.8.3 | Update |
| `vitest` | 4.1.2 | 4.1.4 | Update |
| `@types/node` | 25.5.0 | 25.6.0 | Update |
| `eslint` | 10.1.0 | 10.2.0 | Update |
| `knip` | 6.1.1 | 6.4.1 | Update |
| `@antfu/eslint-config` | 7.7.3 | 8.2.0 | Update |

#### `docs/package.json` (Tier 3)

Tier 1 devDependencies (same as above):
- `@cloudflare/vite-plugin`: 1.31.0 → 1.32.3
- `@cloudflare/workers-types`: 4.20260405.1 → 4.20260415.1
- `vite`: 7.3.2 → 8.0.8
- `@types/node`: 24.10.4 → 25.6.0

Tier 3 (docs-specific) dependencies:
| Package | Current | Latest |
|---|---|---|
| `fumadocs-core` | 16.7.6 | 16.7.16 |
| `fumadocs-mdx` | 14.2.11 | 14.2.14 |
| `@base-ui/react` | 1.3.0 | 1.4.0 |
| `oxlint` | 1.58.0 | 1.60.0 |
| `@vitejs/plugin-react` | 5.1.4 | 6.0.1 |
| `oxfmt` | 0.43.0 | 0.45.0 |

#### `community/package.json` (Tier 3)

- `@cloudflare/workers-types` (dev): 4.20260331.1 → 4.20260415.1
- `vite` (dev): 7.3.2 → 8.0.8
- `vitest` (dev): 4.1.2 → 4.1.4

#### Playground `monorepo-top-level-deps` (Tier 3)

This playground is named `monorepo-top-level-deps` — it likely exercises top-level (root) dev deps. Its package.json was not read; needs verification.

---

## 2. Security Advisories

### Audit Status

`pnpm audit` and `npm audit` both failed:
- **pnpm**: Returns HTTP 410 from `https://registry.npmjs.org/-/npm/v1/security/audits` (endpoint retired)
- **npm**: Returns ENOLOCK (no package-lock.json at root)

The npm registry audit endpoint has been deprecated. No programmatic security audit is available at this time.

### Existing Mitigation Posture

The root `pnpm.overrides` block contains ~40+ pinned version overrides addressing known vulnerabilities in transitive dependencies. These overrides are applied workspace-wide. A representative sample:

| Overridden package | Forced version | Likely advisory |
|---|---|---|
| `tar` | 7.5.11 | CVE for command injection |
| `undici` | 7.24.0 | GHSA security fixes |
| `esbuild@0.18.20` | 0.27.3 | Arbitrary code execution |
| `hono` | 4.12.12 | Security patches |
| `webpack@5.97.1` | 5.105.4 | Prototype pollution |
| `wrangler@4.77.0/4.79.0` | 4.83.0 | Wrangler security fixes |

All existing overrides remain valid. No new overrides are needed based on available data.

### Advisory Drafts

No advisory drafts will be written this cycle, as no new vulnerabilities were identified beyond those already covered by existing overrides.

---

## 3. Lockfile Status

**npm lockfiles found**: None

`find . -name "package-lock.json" -not -path "./node_modules/*"` returned no results outside node_modules. pnpm overrides are fully effective across the workspace.

---

## 4. Playground Workspace References

**All playgrounds using `rwsdk: "workspace:*"`**: ✅ Correct

Playground packages checked: all 31 `playground/*/package.json` files use `rwsdk: "workspace:*"`. No playground pins a published SDK version. No changes needed.

---

## 5. Configuration Issues Found

Several workspace packages contain `pnpm` fields that should be at the root level:

| File | Issue |
|---|---|
| `playground/base-path/package.json` | `pnpm.onlyBuiltDependencies` (ignored) |
| `playground/chakra-ui/package.json` | `pnpm.onlyBuiltDependencies` + `resolutions` (ignored) |
| `playground/shadcn/package.json` | `pnpm.onlyBuiltDependencies` + `resolutions` (ignored) |
| `playground/community/todo-serverquery-and-actions/package.json` | `pnpm.onlyBuiltDependencies` (ignored) |
| `starter/package.json` | `pnpm.onlyBuiltDependencies` (ignored) |

These are non-critical warnings. The fields are silently ignored by pnpm. Not actioned this cycle (cosmetic).

---

## 6. Summary of Required Changes

### Phase 2 — Implementation Plan

1. **Root `package.json`**: Update 6 devDependencies (prettier, vitest, @types/node, eslint, knip, @antfu/eslint-config)
2. **All 31 playground `package.json` files**: Update 4 Tier 1 devDeps each
   - `@cloudflare/vite-plugin`: 1.30.1 → 1.32.3
   - `@cloudflare/workers-types`: 4.20260331.1 → 4.20260415.1
   - `vite`: ~7.3.2 → ~8.0.8
   - `wrangler`: 4.79.0 → 4.83.0
3. **`community/package.json`**: Update 3 devDeps (workers-types, vite, vitest)
4. **`community/playground/todo-serverquery-and-actions/package.json`**: Update 5 devDeps (vite-plugin, workers-types, vite, wrangler, @types/node)
5. **`docs/package.json`**: Update 4 Tier 1 devDeps + 6 Tier 3 deps
6. **`starter/package.json`**: Update 3 Tier 1 devDeps (@cloudflare/vite-plugin, @cloudflare/workers-types, wrangler — vite already at ~7.3.2)
7. **`sdk/package.json`**: Update 3 Tier 1 devDeps (@cloudflare/vite-plugin, @cloudflare/workers-types, vite)
8. **`pnpm install`** to regenerate lockfile
9. **Verify**: `pnpm audit`, `pnpm --filter rwsdk build`, SDK unit tests
