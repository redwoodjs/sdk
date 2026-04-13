# Dependency Audit — 2026-04-13

## Scope
- **pnpm outdated --recursive** across all workspace packages
- **pnpm audit --json** across all workspace packages
- **Tier**: Full pass (all tiers included per task directive)
- **Overrides checked**: Root `package.json` `pnpm.overrides`

---

## Tier 1 — Critical Packages (always included)

| Package | Current | Latest | Workspace | Change? |
|---------|---------|--------|----------|---------|
| react-is | 19.2.4 | 19.2.5 | rwsdk | Yes — minor |
| vite | 7.3.2 | 7.3.2 | rwsdk (dev) | No (already at latest in range ~7.3.2) |
| @cloudflare/vite-plugin | 1.31.0 | 1.32.1 | rwsdk (dev), starter, many playgrounds | Yes — minor |
| @cloudflare/workers-types | 4.20260405.1 | 4.20260413.1 | rwsdk, starter, many playgrounds | Yes — minor |
| wrangler | 4.80.0 | 4.82.1 | rwsdk (dev dep ^4.80.0), starter (4.80.0), root (4.77.0→4.80.0 override) | Yes — minor |

---

## Tier 2 — SDK / Starter Packages (full pass)

| Package | Current | Latest | Workspace | Change? | Notes |
|---------|---------|--------|-----------|---------|-------|
| @types/glob | 9.0.0 | Deprecated | rwsdk | No | Marked deprecated upstream; no compatible replacement |
| @types/node | 25.3.5 | 25.6.0 | rwsdk, starter, various | Yes — minor | |
| @types/node | 25.5.0 | 25.6.0 | rw-sdk-monorepo (root) | Yes — minor | |
| typescript | 6.0.2 | 6.x | rwsdk, starter | No | Deferred — ESLint v10 / @typescript-eslint v8 incompatible with TS6; requires ESLint v9 migration |
| @react-email/components | 1.0.10 | 1.0.12 | resend playground | Yes — patch | |
| @react-email/render | 2.0.4 | 2.0.6 | resend playground | Yes — patch | |
| resend | 6.10.0 | 6.11.0 | resend playground | Yes — minor | |

---

## Tier 3 — Infra / Playgrounds (full pass)

| Package | Current | Latest | Workspace | Change? |
|---------|---------|--------|-----------|---------|
| eslint | 10.1.0 | 10.2.0 | rw-sdk-monorepo (root) | Yes — minor |
| knip | 6.1.1 | 6.4.1 | rw-sdk-monorepo (root) | Yes — minor |
| prettier | 3.8.1 | 3.8.2 | rw-sdk-monorepo (root) | Yes — patch |
| @storybook/react (dev) | 10.3.3 | 10.3.5 | storybook-playground | Yes — patch |
| @storybook/addon-a11y (dev) | 10.3.3 | 10.3.5 | storybook-playground | Yes — patch |
| @storybook/addon-docs (dev) | 10.3.3 | 10.3.5 | storybook-playground | Yes — patch |
| @storybook/addon-links (dev) | 10.3.3 | 10.3.5 | storybook-playground | Yes — patch |
| @storybook/addon-vitest (dev) | 10.3.3 | 10.3.5 | storybook-playground | Yes — patch |
| @storybook/react-vite (dev) | 10.3.3 | 10.3.5 | storybook-playground | Yes — patch |
| storybook (dev) | 10.3.3 | 10.3.5 | storybook-playground | Yes — patch |
| @storybook/testing-library (dev) | 0.2.2 | Deprecated | storybook-playground | No — deprecated upstream |
| vitest (dev) | 4.1.2 | 4.1.4 | rw-sdk-monorepo, rwsdk, many playgrounds | Yes — patch |
| vitest (dev) | 4.0.18 | 4.1.4 | project playground | Yes — minor |
| @fumadocs/base-ui | 16.7.4 | 16.7.14 | docs | Yes — patch |
| fumadocs-core | 16.7.6 | 16.7.14 | docs | Yes — patch |
| fumadocs-mdx | 14.2.11 | 14.2.13 | docs | Yes — patch |
| @base-ui/react | 1.3.0 | 1.4.0 | docs | Yes — minor |
| @mantine/core | 9.0.0 | 9.0.2 | @rwsdk/mantine-playground | Yes — patch |
| @mantine/hooks | 9.0.0 | 9.0.2 | @rwsdk/mantine-playground | Yes — patch |
| postcss (dev) | 8.5.8 | 8.5.9 | @rwsdk/mantine-playground | Yes — patch |
| oxlint (dev) | 1.58.0 | 1.60.0 | docs | Yes — patch |
| @ark-ui/react | 5.35.0 | 5.36.0 | hello-world playground | Yes — patch |
| lucide-react | 1.7.0 | 1.8.0 | hello-world, shadcn-comprehensive | Yes — minor |
| react-hook-form | 7.72.0 | 7.72.1 | shadcn-comprehensive | Yes — patch |
| react-resizable-panels | 4.7.4 | 4.10.0 | shadcn-comprehensive | Yes — minor |
| shadcn (dev) | 4.1.2 | 4.2.0 | shadcn-comprehensive | Yes — minor |
| @base-ui-components/react | 1.0.0-rc.0 | Deprecated | baseui-showcase | No — deprecated upstream |

---

## Security Advisory Landscape

| ID | Package | Severity | CVSS | Current Override | Fix Needed | Tier | Path |
|----|---------|----------|------|-----------------|------------|------|------|
| GHSA-6v7q-wjvx-w8wg | basic-ftp | HIGH | 8.2 | `basic-ftp@5.0.5→5.2.1` and `basic-ftp@5.2.0→5.2.1` | Upgrade override to 5.2.2 | 3 (transitive) | rwsdk → puppeteer/browsers → proxy-agent → pac-proxy-agent → get-uri → basic-ftp |

### Advisory Detail: GHSA-6v7q-wjvx-w8wg
- **Vulnerability**: CRLF injection in basic-ftp — allows arbitrary FTP command execution via credentials and MKD commands
- **Affected versions**: <= 5.2.1
- **Recommended fix**: >= 5.2.2
- **Current state**: Root override pins `basic-ftp@5.0.5→5.2.1` and `basic-ftp@5.2.0→5.2.1` — these are **still vulnerable**
- **Action**: Update override to `"basic-ftp@>=5.0.0 <=5.2.1": "5.2.2"` or add `"basic-ftp@5.2.1": "5.2.2"`

---

## Packages Requiring pnpm Overrides (Phase 2 targets)

1. **`basic-ftp`** — New override required to resolve GHSA-6v7q-wjvx-w8wg
   - Current: `"basic-ftp@5.0.5": "5.2.1"` and `"basic-ftp@5.2.0": "5.2.1"` (vulnerable)
   - New: Replace with `"basic-ftp@>=5.0.0 <=5.2.1": "5.2.2"` OR add `"basic-ftp@5.2.1": "5.2.2"`

---

## Packages Excluded from Update (with rationale)

| Package | Workspace | Reason |
|---------|-----------|--------|
| typescript | rwsdk, starter | Deferred — requires ESLint v9 / @typescript-eslint v9 migration; not a routine greenkeeping item |
| @types/glob | rwsdk | Deprecated upstream — no compatible replacement; rwsdk devDependency only |
| @storybook/testing-library | storybook-playground | Deprecated upstream — no update path |
| @base-ui-components/react | baseui-showcase | Deprecated upstream — no update path |
| @base-ui-components/react | baseui-showcase | Deprecated upstream — no update path |

---

## Summary

- **Outdated packages (with updates available)**: ~35 unique package/version pairs across all workspaces
- **Security advisories**: 1 HIGH (basic-ftp) — current override is stale and still resolves to a vulnerable version
- **Action required**: Update root overrides + update manifest versions across Tier 1/2/3
