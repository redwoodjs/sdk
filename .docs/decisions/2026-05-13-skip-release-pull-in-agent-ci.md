# Skip the release pull step in local agent-ci runs

## Decision

When `AGENT_CI_LOCAL` is set, the release script resets tracked files and skips `git pull --rebase` entirely.

## Context

Local agent-ci release workspaces are pre-populated from the target commit, and their `origin` remote points at a localhost mirror. After we reset tracked changes, `git pull --rebase` still failed because the fake remote is unreachable from the release container.

## Alternatives Considered

### Keep pulling after reset
Rejected. The remote is not a real fetch source in this environment, so the pull fails even when the tree is clean.

### Use `git pull --rebase --autostash`
Rejected. It still needs a reachable remote and would not solve the localhost mirror failure.

### Remove the pull step entirely everywhere
Rejected. Normal developer release runs still benefit from branch freshness checks.

## Consequences

- Local agent-ci release runs no longer depend on the fake remote.
- Developer runs still use `git pull --rebase`.
- The reset step remains, so the agent-ci workspace starts from a clean tracked tree before release logic mutates files.

## Worklog Reference

`~/notes/rw/sdk/worklogs/2026-05-12-ci-security-hardening.md`
