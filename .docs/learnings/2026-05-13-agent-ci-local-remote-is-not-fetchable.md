# Treat local agent-ci remotes as non-fetchable

## Problem

A local agent-ci release run failed with `fatal: unable to access 'http://127.0.0.1/redwoodjs/sdk/': Failed to connect to 127.0.0.1 port 80`, even after the workspace had been reset clean.

## Finding

The release container is given a localhost mirror URL for `origin`. That URL is useful as a placeholder for checkout metadata, but it is not a real fetch target from inside the release script.

## Solution

Do not rely on `git pull` or `git fetch` against the local agent-ci `origin`. Reset tracked files if needed, then continue without network branch-sync in the local runner.

## Context

Observed while validating the non-dry canary release path on `next` after the workspace-reset fix.
