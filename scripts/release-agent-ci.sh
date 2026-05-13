#!/bin/bash
set -e

# Extract auth from existing tooling so the user doesn't need to think about it.
# npm token: from ~/.npmrc (npm config get)
# GitHub token: from gh CLI auth
# Cloudflare: from .env.agent-ci (already there for E2E tests)

VERSION_TYPE="${1:-patch}"
VERSION="${2:-}"

# Try to get npm auth token from npm config
NPM_TOKEN=$(npm config get //registry.npmjs.org/:_authToken 2>/dev/null || true)
if [[ "$NPM_TOKEN" == "undefined" || -z "$NPM_TOKEN" ]]; then
  NPM_TOKEN=""
fi

# Try to get GitHub token from gh CLI
GH_TOKEN=$(gh auth token 2>/dev/null || true)
if [[ "$GH_TOKEN" == "null" || -z "$GH_TOKEN" ]]; then
  GH_TOKEN=""
fi

# Pass through to agent-ci. Missing tokens are fine — the workflow handles
# missing gh gracefully, and npm publish will error naturally without auth.
AI_AGENT=1 \
  NPM_TOKEN="$NPM_TOKEN" \
  GH_TOKEN_FOR_RELEASES="$GH_TOKEN" \
  VERSION_TYPE="$VERSION_TYPE" \
  VERSION="$VERSION" \
  npx @redwoodjs/agent-ci run --workflow .agent-ci/workflows/release.yml
