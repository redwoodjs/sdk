# agent-ci release workspaces can start with tracked dirty files

## Problem

A local agent-ci release run failed at `git pull --rebase` with `You have unstaged changes` even though the source branch checkout was clean from the caller's point of view.

## Finding

The agent-ci checkout log showed tracked modifications already present in the workspace before the release script ran. The dirty state belonged to the runner workspace, not to the release changes we were trying to publish.

## Solution

When running releases under agent-ci locally, reset tracked files with `git reset --hard HEAD` before the pull step. Do not use `git clean -fd`, because the release workflow creates an untracked `.npmrc` for npm auth.

## Context

Observed while validating the canary release path on `next` and then backporting the fix to `main`.
