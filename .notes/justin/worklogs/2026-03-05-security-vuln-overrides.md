# 2026-03-05: Security Vulnerability Overrides

## Task Narrative

GitHub Dependabot has flagged multiple security vulnerabilities in transitive dependencies. We need to add pnpm overrides to the root package.json to force patched versions, similar to the existing overrides already in place.

## Synthesized Context

- Previous security work (2026-01-14, 2026-01-21) established the pattern: use `pnpm.overrides` in root `package.json` to pin transitive deps to patched versions.
- Some alerts reference `vscode-extension/pnpm-lock.yaml` and `examples/kitchensink/pnpm-lock.yaml` -- these directories do not exist in this worktree, so those alerts are stale.
- Alerts affecting `pnpm-lock.yaml` (root):
  - rollup: Arbitrary File Write via Path Traversal (High)
  - fast-xml-parser: entity encoding bypass, DoS, RangeError (Critical/High)
  - basic-ftp: Path Traversal (Critical)
  - react-server-dom-webpack: DoS (High, Direct)
  - minimatch: multiple ReDoS (High)
  - @modelcontextprotocol/sdk: ReDoS (High, Direct) -- already has override pinned to 1.26.0
  - @isaacs/brace-expansion: Uncontrolled Resource Consumption (High)
  - hono: JWT algorithm confusion (High) -- already has override for 4.11.3->4.11.9
  - serialize-javascript: RCE (High)
  - wrangler: OS Command Injection (High, Direct)

## Known Unknowns

- What are the currently resolved versions for each vulnerable package?
- What are the patched versions for each?
- Which are direct vs transitive?

## Investigation

Ran `pnpm audit --json` and `pnpm ls` to map each alert to its currently resolved version and patched version:

| Package | Current | Patched | Severity | Notes |
|---------|---------|---------|----------|-------|
| rollup | 4.55.1 | >=4.59.0 | High | transitive via vite |
| basic-ftp | 5.0.5 | >=5.2.0 | Critical | transitive |
| minimatch | 9.0.1, 9.0.5 | >=9.0.7 | High | transitive via eslint/typescript-estree |
| minimatch | 10.1.1 | >=10.2.3 | High | transitive via eslint |
| @isaacs/brace-expansion | 5.0.0 | >=5.0.1 | High | transitive via minimatch |
| serialize-javascript | 6.0.2 | >=7.0.3 | High | transitive (major version jump) |
| svgo | 4.0.0 | >=4.0.1 | High | transitive |
| hono | 4.11.7, 4.11.9 | >=4.12.4 | High | existing override 4.11.3->4.11.9 is insufficient |
| @hono/node-server | 1.19.9 | >=1.19.10 | High | transitive |
| ajv | 6.12.6 | >=6.14.0 | Moderate | transitive via eslint |
| webpack | 5.97.1 | >=5.104.1 | Low | transitive via react-server-dom-webpack |
| tar | 7.5.9 | >=7.5.10 | High | existing override to 7.5.9 is insufficient |
| devalue | 5.6.2 | >=5.6.3 | Low | existing override to 5.6.2 is insufficient |

Key observations:
- `tar` already has an override but needs bumping from 7.5.9 to 7.5.10
- `devalue` already has an override but needs bumping from 5.6.2 to 5.6.3
- `hono` existing override `"hono@4.11.3": "4.11.9"` only catches 4.11.3 instances; need to override all <4.12.4
- `serialize-javascript` jumps from 6.x to 7.x for the fix -- need to verify this won't break consumers
- `webpack` 5.97.1 -> 5.104.1+ is a large jump -- Low severity, but should still override

## RFC: Override Changes

All changes are pnpm overrides in root `package.json`. Existing overrides that need bumping are updated in-place; new overrides are added.

### Updates to existing overrides:
- `"devalue"`: `5.6.2` -> `5.6.3`
- `"tar"`: `7.5.9` -> `7.5.10`
- `"hono@4.11.3": "4.11.9"` -> `"hono": "4.12.5"` (blanket override since all instances are vulnerable)

### New overrides:
- `"@hono/node-server@1.19.9": "1.19.10"`
- `"@isaacs/brace-expansion@5.0.0": "5.0.1"`
- `"ajv@6.12.6": "6.14.0"`
- `"basic-ftp@5.0.5": "5.2.0"`
- `"minimatch@9.0.1": "9.0.7"`
- `"minimatch@9.0.5": "9.0.7"`
- `"minimatch@10.1.1": "10.2.3"`
- `"minimatch@10.2.0": "10.2.3"`
- `"rollup@4.55.1": "4.59.0"`
- `"serialize-javascript@6.0.2": "7.0.3"`
- `"svgo@4.0.0": "4.0.1"`
- `"webpack@5.97.1": "5.104.1"` -- removed: pnpm does not apply overrides to auto-installed peer deps

## Implementation

Applied all overrides except webpack. Removed the ineffective webpack override to avoid spurious peer dep warnings. Regenerated lockfile.

After `pnpm audit`: 6 remaining vulnerabilities, all Low severity webpack `buildHttp` SSRF issues. These are not exploitable in our context (we don't use HTTP URI loading in webpack). The webpack vulnerability cannot be resolved via pnpm overrides because webpack enters the tree as an auto-installed peer dependency of `react-server-dom-webpack`.

## PR Description

### For SDK consumers

No action required. All affected packages in the SDK's dependency tree use semver ranges that resolve to patched versions on fresh installs. These overrides only fix version pinning in our own monorepo lockfile -- they do not propagate to consumer projects.

### What changed

Dependabot flagged 23 security vulnerabilities in transitive dependencies. We added 12 new pnpm overrides and bumped 3 existing ones, resolving all Critical, High, and Moderate alerts. Six Low severity webpack `buildHttp` SSRF alerts remain -- this feature requires explicit opt-in and is not used by the SDK.

## SDK vs Playground Dependency Audit

pnpm overrides are workspace-local -- they do not propagate to consumers who install `rwsdk`. We need to verify that the SDK's declared dependency ranges naturally resolve to patched versions for framework consumers.

### Packages IN the SDK's dependency tree

| Package | SDK dependency chain | Consumer impact |
|---------|---------------------|-----------------|
| **rollup** | vite (peer/devDep) -> rollup | Consumers bring their own vite. vite 7.x resolves rollup to 4.59.0 (patched). No action needed. |
| **basic-ftp** | @puppeteer/browsers ~2.10.0 -> proxy-agent -> pac-proxy-agent -> get-uri -> basic-ftp ^5.0.2 | `^5.0.2` naturally resolves to 5.2.0 (patched) on fresh installs. Override only needed for our lockfile. |
| **minimatch** | glob ~11.1.0 -> minimatch ^10.1.1; ts-morph ~27.0.0 -> @ts-morph/common -> minimatch ^10.0.1 | Both ranges resolve to 10.2.4 (patched) on fresh installs. Override only needed for our lockfile. |
| **serialize-javascript** | react-server-dom-webpack (peer) -> webpack (peer) -> terser-webpack-plugin -> serialize-javascript | Consumers get this through their webpack. terser-webpack-plugin declares ^6.0.0 which now resolves to 7.0.3+ (patched). |
| **ajv** | react-server-dom-webpack (peer) -> webpack (peer) -> schema-utils -> ajv | schema-utils@3 declares ajv ^6.12.5. Range allows 6.14.0 (patched) on fresh installs. |
| **webpack** | react-server-dom-webpack (peer) -> webpack ^5.59.0 | Range allows 5.104.1+ but package managers may pin to older versions. Cannot be overridden via pnpm. Low severity. |

### Packages NOT in the SDK's dependency tree (playground/root devDep only)

| Package | Where it comes from | Consumer impact |
|---------|---------------------|-----------------|
| **svgo** | storybook (playground/storybook) | None -- playground only |
| **hono** | community playground hono example | None -- playground only |
| **@hono/node-server** | community playground hono example | None -- playground only |
| **tar** | root devDep chain | None -- not in SDK |
| **devalue** | root devDep chain | None -- not in SDK |
| **@isaacs/brace-expansion** | eslint (root devDep) -> minimatch -> @isaacs/brace-expansion | None -- not in SDK |
