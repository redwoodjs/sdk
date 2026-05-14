# A token line in `~/.npmrc` can still be unusable for publish

## Problem

The release wrapper extracted an npm token from `~/.npmrc`, but `npm whoami` still failed and `npm publish` returned `404 Not Found` for `rwsdk`.

## Finding

The presence of a `//registry.npmjs.org/:_authToken=...` line does not guarantee that the token is valid, current, or owned by an account that can publish the package. The token must be validated against the registry before a release run.

## Solution

For non-dry releases, run `npm whoami` against a temp `.npmrc` containing the extracted token and compare the authenticated username to the owners of `rwsdk`. If either check fails, stop before agent-ci starts.

## Context

Observed while fixing the `pnpm release canary` path after the publish step failed with a registry 404.
