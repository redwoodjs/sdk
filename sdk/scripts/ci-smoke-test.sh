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

# Change to the SDK directory to run build and pack
cd "$SDK_ROOT"

# --- Build and Pack SDK ---
echo -e "\n📦 Building and packing SDK..."
pnpm build

TEMP_DIR=$(mktemp -d)
echo "  - Created temp directory: $TEMP_DIR"

TARBALL_NAME=$(npm pack --pack-destination "$TEMP_DIR" | tail -n 1)
TARBALL_PATH="$TEMP_DIR/$TARBALL_NAME"

if [ ! -f "$TARBALL_PATH" ]; then
  echo "❌ npm pack failed to create tarball"
  exit 1
fi
echo "  ✅ Packed to $TARBALL_PATH"

# --- Prepare Project ---
echo -e "\n🔧 Preparing test project..."
PROJECT_DIR="$TEMP_DIR/test-project"
mkdir -p "$PROJECT_DIR"
echo "  - Created test project directory: $PROJECT_DIR"

echo "  - Copying starter files..."
cp -a "$STARTER_PATH/." "$PROJECT_DIR/"

echo "  - Configuring project to not use a frozen lockfile..."
echo "frozen-lockfile=false" >> "$PROJECT_DIR/.npmrc"

echo "  - Installing SDK from tarball..."
INSTALL_COMMAND="add"
EXEC_PACKAGE_MANAGER="$PACKAGE_MANAGER"

if [[ "$PACKAGE_MANAGER" == "npm" ]]; then
  INSTALL_COMMAND="install"
elif [[ "$PACKAGE_MANAGER" == "yarn-classic" ]]; then
  EXEC_PACKAGE_MANAGER="yarn"
fi

(cd "$PROJECT_DIR" && "$EXEC_PACKAGE_MANAGER" "$INSTALL_COMMAND" "$TARBALL_PATH")

# --- Run Smoke Tests ---
echo -e "\n🔬 Running smoke tests..."
ARTIFACT_DIR="$MONOREPO_ROOT/smoke-test-artifacts/$STARTER"
mkdir -p "$ARTIFACT_DIR"

# The smoke test script is run from the SDK directory
if ! pnpm smoke-test --path="$PROJECT_DIR" --no-sync --artifact-dir="$ARTIFACT_DIR" --skip-style-tests --package-manager="$PACKAGE_MANAGER"; then
  echo "❌ Smoke tests failed."
  exit 1
fi

echo -e "\n✅ Smoke tests passed for '$STARTER' with '$PACKAGE_MANAGER'!"

# --- Cleanup ---
echo "  - Cleaning up temp directory..."
rm -rf "$TEMP_DIR"
