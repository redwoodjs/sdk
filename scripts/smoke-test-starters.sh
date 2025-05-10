#!/usr/bin/env bash
set -euo pipefail

# Script to run smoke tests for RedwoodJS starter templates
# This is a thin wrapper around the SDK's smoke-test functionality

# Set working directory to the SDK root
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
SDK_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"
cd "$SDK_ROOT"

# Create artifact directory
ARTIFACT_DIR="$SDK_ROOT/smoke-test-artifacts"
mkdir -p "$ARTIFACT_DIR"

echo "🚀 Starting smoke tests for all starters"
FAILED=0

# Test minimal starter with root path
echo "🔥 Running smoke test for minimal starter with path /"
cd "$SDK_ROOT/sdk"
if ! CLOUDFLARE_ACCOUNT_ID="$CLOUDFLARE_ACCOUNT_ID" CLOUDFLARE_API_TOKEN="$CLOUDFLARE_API_TOKEN" pnpm smoke-test --url="/" --path="$SDK_ROOT/starters/minimal" --artifact-dir="$ARTIFACT_DIR/minimal" --sync; then
  echo "❌ Smoke test failed for minimal starter"
  FAILED=1
fi

# Test standard starter with /user/login path
echo "🔥 Running smoke test for standard starter with path /user/login"
cd "$SDK_ROOT/sdk"
if ! CLOUDFLARE_ACCOUNT_ID="$CLOUDFLARE_ACCOUNT_ID" CLOUDFLARE_API_TOKEN="$CLOUDFLARE_API_TOKEN" pnpm smoke-test --url="/user/login" --path="$SDK_ROOT/starters/standard" --artifact-dir="$ARTIFACT_DIR/standard" --sync; then
  echo "❌ Smoke test failed for standard starter"
  FAILED=1
fi

# Report results
if [ $FAILED -eq 0 ]; then
  echo "🎉 All smoke tests passed!"
  exit 0
else
  echo "❌ Some smoke tests failed. Check the artifacts for details."
  exit 1
fi 