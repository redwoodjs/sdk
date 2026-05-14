# Validate the npm publish token before launching agent-ci

## Decision

The release wrapper validates the extracted npm token before launching agent-ci for non-dry releases.

## Context

A release run can reach `npm publish` with a token that is present in `~/.npmrc` but still cannot authenticate to registry.npmjs.org or publish the `rwsdk` package. In that case, the failure happens late and looks like a publish problem rather than an auth problem.

## Alternatives Considered

### Let agent-ci fail at publish time
Rejected. It wastes time and hides the real failure mode behind an npm 404.

### Validate only that a token exists
Rejected. A token can exist and still belong to the wrong account or be stale.

### Validate with `npm whoami` and package ownership
Chosen. It checks the exact token we are about to forward and confirms the token belongs to an owner of `rwsdk`.

## Consequences

- Non-dry release attempts fail fast when the token is invalid or wrong-account.
- Dry runs stay permissive so branch-aware canary validation still works without a publish-capable token.
- The wrapper now reports a direct auth error instead of leaving us to infer one from `npm publish`.

## Worklog Reference

`~/notes/rw/sdk/worklogs/2026-05-12-ci-security-hardening.md`
