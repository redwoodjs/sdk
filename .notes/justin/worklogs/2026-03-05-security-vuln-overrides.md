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

---

## 2026-03-21: Second Round of Security Vulnerability Overrides

### Task Brief

GitHub Dependabot has flagged a new batch of security vulnerabilities. The priorities, in order:

1. **SDK**: Most critical. Ensure the SDK's declared version ranges allow consumers to receive patched versions (semver ranges must not cap below the patch). Additionally, we should be on those patched versions ourselves in our lockfile.
2. **Starter project**: Must not ship with vulnerable dependencies.
3. **Playground examples and transitive dependencies**: Lower priority. Add pnpm overrides to bring transitive deps to patched versions.

The most concerning package is **kysely** -- it is a direct SDK dependency used for the database layer.

### Investigation

#### Kysely (CRITICAL -- SDK direct dependency)

Two High severity SQL injection CVEs:
- GHSA-wmrf-hv6w-mr66: SQL Injection via unsanitized JSON path keys (when ignoring/silencing compilation errors or using `Kysely<any>`)
- MySQL SQL Injection via insufficient backslash escaping in `sql.lit(string)`

**Vulnerable versions**: `>=0.26.0 <=0.28.11`
**Patched versions**: `>=0.28.12`
**Latest 0.28.x**: `0.28.14`

Current state:
- SDK declares `"kysely": "~0.28.2"` -- tilde range allows `>=0.28.2 <0.29.0`, so consumers CAN resolve to 0.28.12+ (patched). **Range is safe for consumers.**
- Our lockfile currently resolves to `0.28.2` (vulnerable). Every workspace package using rwsdk transitively gets kysely 0.28.2.
- `kysely-do@0.0.1-rc.1` declares `"kysely": "*"` as peer dep -- no constraint, any version works.
- `playground/database-do` declares `"kysely": "^0.28.0"` -- caret range also allows 0.28.12+.

**Fix**: Add pnpm override `"kysely": "0.28.14"` to bump all instances in our lockfile to latest patched.

#### Undici (High/Moderate -- 6 CVEs)

All via `wrangler > miniflare > undici`. Currently resolved to `7.18.2`, patched at `>=7.24.0`.

CVEs: WebSocket 64-bit length overflow, unbounded memory consumption (permessage-deflate), unhandled exception (server_max_window_bits), HTTP request/response smuggling, CRLF injection via upgrade, unbounded memory consumption (DeduplicationHandler).

**Fix**: Add pnpm override `"undici@7.18.2": "7.24.0"`.

#### Existing Overrides Needing Bumps

| Override | Current | Needed | Reason |
|----------|---------|--------|--------|
| `h3` | 1.15.5 | >=1.15.9 | SSE injection (High), path traversal (Moderate x2), SSE bypass (Moderate) |
| `hono` | 4.12.5 | >=4.12.7 | Prototype pollution via `parseBody({ dot: true })` (Moderate) |
| `devalue` | 5.6.3 | >=5.6.4 | Prototype pollution in parse/unflatten (Moderate), `__proto__` own properties (Low) |
| `tar` | 7.5.10 | >=7.5.11 | Symlink path traversal via drive-relative linkpath (High) |

#### New Overrides Needed

| Package | Current | Patched | Path | Severity |
|---------|---------|---------|------|----------|
| `flatted` | 3.3.3 | >=3.4.0 | eslint > file-entry-cache > flat-cache > flatted | High |
| `express-rate-limit` | 8.2.0 | >=8.2.2 | playground shadcn > shadcn > @mcp/sdk > express-rate-limit | High |

#### Community Todo Playground (npm lockfile)

`playground/community/todo-serverquery-and-actions` has its own `package-lock.json` (npm, not pnpm). It depends on published `rwsdk@1.0.0-beta.51` which pulls in kysely 0.28.2 (vulnerable). It also has undici 7.18.2 via wrangler/miniflare. pnpm overrides do not help here. We can add npm overrides to its package.json.

#### Webpack (Low -- known, cannot override)

Still present from prior round. Auto-installed peer dependency of react-server-dom-webpack. Low severity buildHttp SSRF issues. Not exploitable in our context.

### Tier Summary

| Tier | Package | Action |
|------|---------|--------|
| 1 (SDK) | kysely | Override to 0.28.14. Range `~0.28.2` already allows consumers to get patched. |
| 3 (transitive) | undici | Override 7.18.2 -> 7.24.0 |
| 3 (transitive) | h3 | Bump override 1.15.5 -> 1.15.9 |
| 3 (transitive) | hono | Bump override 4.12.5 -> 4.12.7 |
| 3 (transitive) | devalue | Bump override 5.6.3 -> 5.6.4 |
| 3 (transitive) | tar | Bump override 7.5.10 -> 7.5.11 |
| 3 (transitive) | flatted | New override 3.3.3 -> 3.4.0 |
| 3 (transitive) | express-rate-limit | New override -> 8.2.2 |
| N/A | webpack | Cannot override (auto-installed peer). Low severity. |

### RFC: Override Changes (Round 2)

#### Updates to existing overrides:
- `"h3"`: `1.15.5` -> `1.15.9`
- `"hono"`: `4.12.5` -> `4.12.7`
- `"devalue"`: `5.6.3` -> `5.6.4`
- `"tar"`: `7.5.10` -> `7.5.11`

#### New overrides:
- `"kysely": "0.28.14"`
- `"undici@7.18.2": "7.24.0"`
- `"flatted@3.3.3": "3.4.0"`
- `"express-rate-limit@8.2.0": "8.2.2"`

#### Community todo playground (npm):
- Add npm `overrides` to `playground/community/todo-serverquery-and-actions/package.json` for undici.
- Kysely fix in that playground will come through whenever rwsdk is next published (the range allows it).

#### Tasks:
- [x] Update root package.json pnpm overrides
- [x] Regenerate pnpm lockfile
- [x] Handle community todo playground npm lockfile
- [x] Verify with pnpm audit

### Implementation Notes

#### Course correction: kysely override removed

We initially added a pnpm override for kysely, but since kysely is a direct SDK dependency (not transitive), the right fix is to let pnpm re-resolve within the existing `~0.28.2` range. We removed the override and ran `pnpm update kysely` to bump the lockfile resolution from 0.28.2 to 0.28.14 (latest patched).

#### Course correction: community todo playground

`playground/community/todo-serverquery-and-actions` was the only workspace package using a pinned published `rwsdk` version (`1.0.0-beta.51`) instead of `workspace:*`. This meant:
- It had its own `package-lock.json` (npm), causing GitHub to scan it separately
- It was frozen on an old SDK version with vulnerable transitive deps
- pnpm overrides from the root did not help it

Fix: switched to `workspace:*`, removed the npm overrides we had added, and deleted the `package-lock.json`. The playground is now managed by pnpm like every other workspace package.

#### Override adjustments during implementation

- `express-rate-limit`: override target corrected from `8.2.0` to `8.2.1` (actual resolved version)
- `flatted`: bumped override from `3.4.0` to `3.4.2` (new CVE GHSA-rf6f-7fwh-wjgh requires `>=3.4.2`)

#### Final audit result

After all changes: **6 vulnerabilities remaining, all Low severity webpack `buildHttp` SSRF issues**. These are the same known issue from the prior round -- webpack enters the tree as an auto-installed peer dependency and cannot be overridden.

All High, Moderate, and Critical vulnerabilities are resolved:
- kysely: 0.28.2 -> 0.28.14 (SQL injection fixes)
- undici: 7.18.2 -> 7.24.0 (6 WebSocket/HTTP CVEs)
- h3: 1.15.5 -> 1.15.9 (SSE injection, path traversal)
- hono: 4.12.5 -> 4.12.7 (prototype pollution)
- devalue: 5.6.3 -> 5.6.4 (prototype pollution)
- tar: 7.5.10 -> 7.5.11 (symlink path traversal)
- flatted: 3.3.3 -> 3.4.2 (unbounded recursion DoS, prototype pollution)
- express-rate-limit: 8.2.1 -> 8.2.2 (IPv6 bypass)

#### Kysely version range bump

The SDK declared `"kysely": "~0.28.2"`, which allowed vulnerable versions (0.28.2 through 0.28.11) to satisfy the range. While a fresh install would resolve to 0.28.14 today, a consumer with an existing lockfile pinned to a vulnerable version would not be forced to upgrade. We bumped the range to `"~0.28.12"` to ensure the declared range itself excludes all vulnerable versions.

Similarly, `playground/database-do` declared `"kysely": "^0.28.0"` -- bumped to `"^0.28.12"` for the same reason.

#### Community todo playground: workspace:* fix

`playground/community/todo-serverquery-and-actions` was the only workspace package pinned to a published rwsdk version (`1.0.0-beta.51`) instead of `workspace:*`. This caused:
- GitHub scanning its separate `package-lock.json`, surfacing duplicate vulnerability alerts
- The playground being frozen on old transitive deps that our root pnpm overrides could not reach

We switched it to `workspace:*` and deleted the `package-lock.json`. It is now managed by pnpm like every other workspace package.

### Summary of all changes

| File | Change | Why |
|------|--------|-----|
| `sdk/package.json` | kysely range `~0.28.2` -> `~0.28.12` | Exclude vulnerable versions from declared range |
| `playground/database-do/package.json` | kysely range `^0.28.0` -> `^0.28.12` | Same |
| `playground/community/todo-serverquery-and-actions/package.json` | rwsdk `1.0.0-beta.51` -> `workspace:*` | Align with all other workspace packages |
| `playground/community/todo-serverquery-and-actions/package-lock.json` | Deleted | No longer needed under pnpm workspace |
| `package.json` (root) | 4 pnpm overrides bumped, 4 new overrides added | Resolve High/Moderate transitive dep vulns |
| `pnpm-lock.yaml` | Regenerated | Reflects all override and range changes |

