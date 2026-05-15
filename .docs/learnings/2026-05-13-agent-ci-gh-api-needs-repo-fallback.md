# Use `GITHUB_REPOSITORY` when agent-ci rewrites the local remote

## Problem

Inside local agent-ci runs, `git remote get-url origin` points at a localhost mirror instead of `github.com`, so canary tag lookup cannot derive a GitHub repo slug from the remote URL alone.

## Finding

The local runner also shims `git ls-remote`, so shell-based tag discovery is not trustworthy there. The reliable source for GitHub tag lookups is `gh api`, and it needs a repo slug. When the remote URL is not a GitHub URL, we must fall back to `GITHUB_REPOSITORY`.

## Solution

When the remote URL does not match `https://github.com/*` or `git@github.com:*`, use `GITHUB_REPOSITORY` as the repo slug before calling `gh api repos/<slug>/git/matching-refs/tags/v`.

## Context

Observed while making the branch-aware `pnpm release canary --dry` path work under agent-ci on `next`.
