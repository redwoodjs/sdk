# Reset tracked agent-ci workspace changes before release pull

## Decision

When `AGENT_CI_LOCAL` is set, the release script resets tracked files with `git reset --hard HEAD` before running `git pull --rebase`.

## Context

Local agent-ci release runs can start from a workspace that already has tracked file modifications. In that state, `git pull --rebase` fails even when the source checkout appears clean from the caller's perspective.

## Alternatives Considered

### Fail fast on dirty workspaces
Rejected. The dirty state belongs to the local agent-ci workspace, not the release intent, so failing there blocks valid release runs.

### `git clean -fd`
Rejected. The release workflow writes an untracked `sdk/.npmrc` for npm auth, and `git clean -fd` would remove it.

### `git pull --rebase --autostash`
Considered. It would make the pull succeed, but `git reset --hard HEAD` is narrower and keeps the release flow focused on tracked workspace state only.

## Consequences

- Agent-ci local runs now recover from runner-owned tracked modifications before release update logic runs.
- Local developer runs are unchanged unless `AGENT_CI_LOCAL` is set.
- The release workflow still keeps the pull step for branch freshness, but no longer depends on the workspace already being pristine.

## Worklog Reference

`~/notes/rw/sdk/worklogs/2026-05-12-ci-security-hardening.md`
