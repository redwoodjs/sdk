# Pass the release branch through `RWSDK_RELEASE_BRANCH`

## Decision

We pass the current git branch from `pnpm release` into agent-ci through `RWSDK_RELEASE_BRANCH` and use that value inside the release workflow and release script instead of relying on agent-ci's synthetic `github.ref`.

## Context

Local agent-ci runs still synthesize `github.ref: refs/heads/main` even when we launch from `next`. That made canary selection branch-incorrect: the release logic could not distinguish a `next` dry run from a `main` dry run.

## Alternatives Considered

### Rely on `github.ref`
Rejected. In local agent-ci runs it reports `main`, so it does not reflect the current checkout branch.

### Derive the branch from the checked-out commit alone
Rejected. The agent-ci container can be seeded from a synthetic workspace or a detached commit, so commit ancestry alone is not a stable branch signal for this flow.

### Hardcode branch rules in the workflow
Rejected. The release wrapper already knows the current branch and should be the single source of truth for the local run.

## Consequences

- `scripts/release-agent-ci.sh` must export the branch.
- `.agent-ci/workflows/release.yml` must gate release execution on `RWSDK_RELEASE_BRANCH`.
- `sdk/scripts/release.sh` must prefer `RWSDK_RELEASE_BRANCH` and only fall back to `git branch --show-current` outside agent-ci.
- Dry runs on `next` now plan the next canary version line correctly.

## Worklog Reference

`~/notes/rw/sdk/worklogs/2026-05-12-ci-security-hardening.md`
