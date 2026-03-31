# Resolve transitive security advisories via pnpm workspace overrides

## Decision

When a security advisory affects a transitive dependency — a package that enters the dependency graph through another dep rather than being declared directly — resolve it by adding a pnpm override in the root `package.json`. Do not modify the intermediate package's own `package.json`.

## Context

The 2026-03-31 greenkeeping pass resolved four transitive advisories:
- `path-to-regexp@8.3.0` → `8.4.0` (CVE-2026-4926, CVE-2026-4923)
- `serialize-javascript@6.0.2` → `7.0.5`
- `serialize-javascript@7.0.3` → `7.0.5`
- `brace-expansion@>=5.0.0 <5.0.5` → `5.0.5`

None of these packages are declared as direct dependencies of any workspace package. They are pulled in by other transitive deps. Modifying their source packages would require publishing new versions upstream first, which is out of scope for a monorepo greenkeeping task.

## Alternatives Considered

### Modify the intermediate package's package.json
Not viable for monorepo greenkeeping. Upstream packages may have their own release cadence and compatibility constraints.

### Ignore the advisory
Not acceptable. Even transitive vulnerabilities in build tooling can become attack vectors.

### Pin the affected packages via npm overrides (in every consumer)
Inefficient. A single pnpm workspace override at the root applies to all workspace packages simultaneously.

## Consequences

- The override applies to all workspaces in the pnpm workspace. No per-package config needed.
- Overrides are reflected in `pnpm-lock.yaml`, which is committed. CI will fail if overrides become stale.
- This approach affects only the monorepo's own build. Downstream consumers of `rwsdk` are unaffected — the SDK itself is unchanged.
- Multiple version ranges for the same package can coexist in overrides when different transitive chains pull in different versions (e.g. `serialize-javascript@6.0.2` and `serialize-javascript@7.0.3` both needing `7.0.5`).
