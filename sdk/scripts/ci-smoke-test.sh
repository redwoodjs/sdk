#!/usr/bin/env bash

set -euo pipefail

# This script is for running smoke tests in CI.
# It simulates a real-world installation of the SDK by packing it into a
# tarball and installing it in a fresh starter project.

# It accepts the following arguments:
# --package-manager: The package manager to use (e.g., "pnpm", "npm", "yarn", "yarn-classic").
# --path: The path to the project to test. Defaults to a new temporary directory.
# --no-sync: Disables syncing of the local SDK build to the test project.
# --artifact-dir: The directory to store test artifacts. Defaults to "smoke-test-artifacts/<starter>".
# --skip-style-tests: Skips the style-related tests.
#
# The script will create a temporary project, install the specified starter,
# install the SDK from a local tarball, and run a series of checks.
# It requires `wrangler` and the specified package manager to be installed.
#
# Environment variables can be used to override default timeouts and retries.
# See the script for details.
#
################################################################################

# --- Argument parsing ---
STARTER="starter"
PACKAGE_MANAGER=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --package-manager)
      PACKAGE_MANAGER="$2"
      shift
      shift
      ;;
    *)
      echo "Unknown parameter passed: $1"
      exit 1
      ;;
  esac
done

if [[ -z "$PACKAGE_MANAGER" ]]; then
  echo "❌ Missing required arguments: --package-manager"
  exit 1
fi

echo "🚀 Starting smoke test for '$STARTER' starter with '$PACKAGE_MANAGER'"

# --- Setup ---
# Get the absolute path of the script's directory
SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &> /dev/null && pwd)
# The SDK root is one level up from the script's directory
SDK_ROOT="$SCRIPT_DIR/.."
# The monorepo root is two levels up from the script's directory
MONOREPO_ROOT="$SDK_ROOT/.."
STARTER_PATH="$MONOREPO_ROOT/$STARTER"

if [ ! -d "$STARTER_PATH" ]; then
  echo "❌ Starter directory not found at $STARTER_PATH"
  exit 1
fi

# Change to the SDK directory to run smoke tests
cd "$SDK_ROOT"

# --- Build SDK ---
echo -e "\n📦 Building SDK..."
pnpm build

# --- Run Smoke Tests ---
echo -e "\n🔬 Running smoke tests..."
ARTIFACT_DIR="$MONOREPO_ROOT/smoke-test-artifacts/$STARTER"
mkdir -p "$ARTIFACT_DIR"

# The smoke test handles all project setup, tarball creation, and installation
if ! pnpm smoke-test --path="$STARTER_PATH" --artifact-dir="$ARTIFACT_DIR" --skip-style-tests --package-manager="$PACKAGE_MANAGER"; then
  echo "❌ Smoke tests failed."
  exit 1
fi

echo -e "\n✅ Smoke tests passed for '$STARTER' with '$PACKAGE_MANAGER'!"
