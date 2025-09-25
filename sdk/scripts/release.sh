#!/bin/bash

set -e  # Stop on first error

SUCCESS_FLAG=false # Default to failure. This will be checked by the cleanup trap.

DEPENDENCY_NAME="rwsdk"  # Replace with the actual package name

show_help() {
  echo "Usage: pnpm release <patch|minor|test|explicit> [--version <string>] [--dry]"
  echo
  echo "Automates version bumping, publishing, and dependency updates for $DEPENDENCY_NAME."
  echo "For safety, only 'patch', 'minor', and 'test' bumps can be calculated automatically."
  echo "To release a major or pre-release version, you MUST use the 'explicit' version_type and provide the exact version string with '--version'."
  echo
  echo "Arguments:"
  echo "  patch|minor|test    Calculates the next version of this type automatically."
  echo "  explicit            Requires the '--version' flag to specify the exact version to release."
  echo ""
  echo "Process:"
  echo "  1.  Calculates new version (for patch/minor/test) or uses the manual version (for explicit), and updates package.json."
  echo "  2.  Commits the version change."
  echo "  3.  Builds the package with NODE_ENV=production."
  echo "  4.  Bundles the package into a .tgz tarball using \`npm pack\`."
  echo "  5.  Performs a comprehensive smoke test on the packed tarball:"
  echo "      - Verifies the packed \`dist\` contents match the local build via checksum."
  echo "      - Runs \`npx rw-scripts smoke-tests\` in a temporary project."
  echo "  6.  If smoke tests pass, publishes the .tgz tarball to npm (using --tag pre for prereleases and --tag test for test builds)."
  echo "  7.  On successful publish (for non-prereleases):"
  echo "      - Updates dependencies in the monorepo."
  echo "      - Amends the initial commit with dependency updates."
  echo "      - Tags the commit and pushes to the remote repository."
  echo "  8.  On failure (publish or smoke test):"
  echo "      - The version commit is reverted."
  echo "      - Temporary files are cleaned up."
  echo ""
  echo "Options:"
  echo "  --dry               Simulate the release process without making changes"
  echo "  --version <v>       Manually specify a version string. MUST be used with the 'explicit' version_type."
  echo "  --skip-smoke-tests  Bypass the smoke testing step. Use with caution."
  echo "  --help              Show this help message"
  echo ""
  echo "Examples:"
  echo "  pnpm release patch                    # 0.1.0 -> 0.1.1"
  echo "  pnpm release minor                    # 0.1.1 -> 0.2.0"
  echo "  pnpm release test                     # 1.0.0 -> 1.0.0-test.0 (published as @test)"
  echo "  pnpm release explicit --version 1.0.0 # Release a major version"
  echo "  pnpm release explicit --version 1.0.0-rc.0 # Release a pre-release"
  exit 0
}

validate_args() {
  for arg in "$@"; do
    if [[ "$arg" == --* && "$arg" != "--dry" && "$arg" != "--help" && "$arg" != "--version" && "$arg" != "--skip-smoke-tests" ]]; then
      echo "Error: Unknown flag '$arg'"
      echo "Use --help to see available options"
      echo ""
      show_help  # This will show the help message and exit
    fi
  done
}

# Reorder argument handling
validate_args "$@"

# Initialize variables
DRY_RUN=false
VERSION_TYPE=""
MANUAL_VERSION=""
SKIP_SMOKE_TESTS=false

# Process all arguments
i=1
while [[ $i -le $# ]]; do
  arg="${!i}"
  case "$arg" in
    --help)
      show_help
      ;;
    --dry)
      DRY_RUN=true
      ;;
    --skip-smoke-tests)
      SKIP_SMOKE_TESTS=true
      ;;
    --version)
      i=$((i + 1))
      MANUAL_VERSION="${!i}"
      if [[ -z "$MANUAL_VERSION" ]]; then
        echo "Error: --version requires a value"
        echo ""
        show_help
      fi
      ;;
    patch|minor|test|explicit)
      VERSION_TYPE=$arg
      ;;
  esac
  i=$((i + 1))
done

# Validate required arguments
if [[ -z "$VERSION_TYPE" ]]; then
  echo "Error: Version type (patch|minor|test|explicit) is required."
  echo ""
  show_help
fi

# Validate illegal argument combinations
if [[ "$VERSION_TYPE" == "explicit" && -z "$MANUAL_VERSION" ]]; then
  echo "Error: The 'explicit' version_type requires the --version flag to be set."
  exit 1
fi

if [[ "$VERSION_TYPE" != "explicit" && -n "$MANUAL_VERSION" ]]; then
  echo "Error: The --version flag can only be used with the 'explicit' version_type."
  exit 1
fi

if [[ "$VERSION_TYPE" == "test" && -n "$MANUAL_VERSION" ]]; then
  echo "Error: Manual version cannot be specified for 'test' releases."
  exit 1
fi

# After argument validation and before version calculation
echo -e "\n🔄 Pulling for changes..."
if [[ "$DRY_RUN" == true ]]; then
  echo "  [DRY RUN] git pull --rebase"
else
  git pull --rebase
fi

echo -e "\n📦 Making sure dependencies are up to date..."
if [[ "$DRY_RUN" == true ]]; then
  echo "  [DRY RUN] pnpm install --frozen-lockfile"
else
  pnpm install --frozen-lockfile --ignore-scripts
fi

echo -e "\n🏗️  Building package..."
if [[ "$DRY_RUN" == true ]]; then
  echo "  [DRY RUN] NOTE: Forcing build to allow for artifact verification."
fi
NODE_ENV=production pnpm build

CURRENT_VERSION=$(npm pkg get version | tr -d '"')

if [[ "$VERSION_TYPE" == "explicit" ]]; then
  NEW_VERSION="$MANUAL_VERSION"
elif [[ "$VERSION_TYPE" == "test" ]]; then
  # Use a timestamp for test versions instead of a counter to avoid conflicts between branches
  # Format: YYYYMMDDHHMMSS
  TIMESTAMP=$(date "+%Y%m%d%H%M%S")
  # Extract base version (strip any existing test suffix)
  if [[ "$CURRENT_VERSION" =~ ^(.*)-test\..*$ ]]; then
    BASE_VERSION="${BASH_REMATCH[1]}"
  else
    BASE_VERSION="$CURRENT_VERSION"
  fi
  NEW_VERSION="$BASE_VERSION-test.$TIMESTAMP"
else
  # Handle regular versions (patch, minor, major)
  NEW_VERSION=$(npx semver -i "$VERSION_TYPE" "$CURRENT_VERSION")
fi

echo -e "\n📦 Planning version bump to $NEW_VERSION ($VERSION_TYPE)..."
if [[ "$DRY_RUN" == true ]]; then
  echo "  [DRY RUN] sed -i.bak \"s/\\\"version\\\": \\\"[^\\\"]*\\\"/\\\"version\\\": \\\"$NEW_VERSION\\\"/\" package.json && rm package.json.bak"
  echo "  [DRY RUN] Git commit version change"
else
  sed -i.bak "s/\"version\": \"[^\"]*\"/\"version\": \"$NEW_VERSION\"/" package.json && rm package.json.bak
  git add package.json
  git commit -m "chore(release): $NEW_VERSION"
fi

TAG_NAME="v$NEW_VERSION"
if [[ -n "$GITHUB_ENV" ]]; then
  echo "TAG_NAME=$TAG_NAME" >> "$GITHUB_ENV"
fi

echo -e "\n📦 Packing package..."
if [[ "$DRY_RUN" == true ]]; then
  echo "  [DRY RUN] NOTE: Actually packing package to allow for smoke testing."
fi

# The `TEMP_DIR` is created here so we can pack the tarball into it
# and keep the git working directory clean.
TEMP_DIR=$(mktemp -d)

# Always pack the package to allow for smoke testing, even in a dry run.
TARBALL_NAME=$(npm pack --pack-destination "$TEMP_DIR" | tail -n 1)
TARBALL_PATH="$TEMP_DIR/$TARBALL_NAME"
if [ ! -f "$TARBALL_PATH" ]; then
  echo "❌ npm pack failed to create tarball"
  exit 1
fi
echo "  ✅ Packed to $TARBALL_PATH"

echo -e "\n🔬 Smoke testing package..."
if [[ "$SKIP_SMOKE_TESTS" == true ]]; then
  echo "  ⏭️  Skipping smoke tests as requested."
else
  # The smoke test runs in both normal and dry-run modes.

  # This cleanup function will be called on EXIT.
  # It checks if the script is finishing successfully or not.
  cleanup() {
    # If the script did not complete successfully, preserve assets for inspection.
    if [[ "$SUCCESS_FLAG" == false ]]; then
      echo -e "\n❌ A failure occurred. Preserving temp directory for inspection:"
      echo "  - Temp directory: $TEMP_DIR"
    else
      # Otherwise (on success), clean up the temp dir.
      if [[ -n "$TEMP_DIR" && -d "$TEMP_DIR" ]]; then
        echo "  - Cleaning up temp directory..."
        rm -rf "$TEMP_DIR"
      fi
    fi
    # The tarball is stored in TEMP_DIR and cleaned up with it.
  }

  # Set the trap *after* creating the temp dir, so the variable is available.
  trap cleanup EXIT

  # Sanitize the version to create a valid directory name, which in turn
  # will be used to generate a valid worker name for the smoke test.
  PROJECT_DIR="$TEMP_DIR/test"
  mkdir -p "$PROJECT_DIR"

  if [[ -n "$GITHUB_OUTPUT" ]]; then
    echo "project-dir=$PROJECT_DIR" >> "$GITHUB_OUTPUT"
  fi

  echo "  - Created temp project dir for testing: $PROJECT_DIR"

  echo "  - Copying minimal starter to project dir..."
  # Get the absolute path of the script's directory
  SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &> /dev/null && pwd)
  # The monorepo root is two levels up from the script's directory
  MONOREPO_ROOT="$SCRIPT_DIR/../.."
  cp -a "$MONOREPO_ROOT/starters/minimal/." "$PROJECT_DIR/"

  echo "  - Configuring temp project to not use frozen lockfile..."
  echo "frozen-lockfile=false" > "$PROJECT_DIR/.npmrc"

  echo "  - Installing packed tarball in project dir..."
  (cd "$PROJECT_DIR" && pnpm add "$TARBALL_PATH")

  PACKAGE_NAME=$(npm pkg get name | tr -d '"')
  INSTALLED_DIST_PATH="$PROJECT_DIR/node_modules/$PACKAGE_NAME/dist"

  echo "  - Verifying installed package contents..."
  if [ ! -d "$INSTALLED_DIST_PATH" ]; then
      echo "  ❌ Error: dist/ directory not found in installed package at $INSTALLED_DIST_PATH."
      exit 1
  fi

  # To ensure the package is built and packed correctly, we'll compare
  # a checksum of the file lists from the original `dist` directory and the
  # one installed from the tarball. They must match exactly.
  ORIGINAL_DIST_CHECKSUM=$( (cd dist && find . -type f | sort) | md5sum)
  INSTALLED_DIST_CHECKSUM=$( (cd "$INSTALLED_DIST_PATH" && find . -type f | sort) | md5sum)

  echo "    - Original dist checksum: $ORIGINAL_DIST_CHECKSUM"
  echo "    - Installed dist checksum: $INSTALLED_DIST_CHECKSUM"

  if [[ "$ORIGINAL_DIST_CHECKSUM" != "$INSTALLED_DIST_CHECKSUM" ]]; then
    echo "  ❌ Error: File list in installed dist/ does not match original dist/."
    echo "  This indicates an issue with the build or packaging process."
    exit 1
  else
    echo "  ✅ Installed package contents match the local build."
  fi

  echo "  - Running smoke tests..."
  # The CWD is the package root (sdk/sdk), so we can run pnpm smoke-test directly.
  # We pass the path to the temp project directory where the minimal starter was installed.
  # We also specify an artifact directory *within* the temp directory.
  # todo(justinvdm, 11 Aug 2025): Fix style test flakiness
  if ! pnpm smoke-test --path="$PROJECT_DIR" --no-sync --artifact-dir="$TEMP_DIR/artifacts" --skip-style-tests; then
    echo "  ❌ Smoke tests failed."
    exit 1
  fi
  echo "  ✅ Smoke tests passed."
fi

echo -e "\n🚀 Publishing version $NEW_VERSION..."
if [[ "$DRY_RUN" == true ]]; then
  if [[ "$VERSION_TYPE" == "test" ]]; then
    echo "  [DRY RUN] npm publish '$TARBALL_PATH' --tag test"
  elif [[ "$NEW_VERSION" =~ - ]]; then
    echo "  [DRY RUN] npm publish '$TARBALL_PATH' --tag pre"
  else
    echo "  [DRY RUN] npm publish '$TARBALL_PATH'"
  fi
else
  PUBLISH_CMD="npm publish \"$TARBALL_PATH\""
  if [[ "$VERSION_TYPE" == "test" ]]; then
    PUBLISH_CMD="$PUBLISH_CMD --tag test"
  elif [[ "$NEW_VERSION" =~ - ]]; then
    PUBLISH_CMD="$PUBLISH_CMD --tag pre"
  fi
  if ! eval $PUBLISH_CMD; then
    echo -e "\n❌ Publish failed. Rolling back version commit..."
    git reset --hard HEAD~1
    # The trap will clean up the tarball
    exit 1
  fi
  echo "  ✅ Published successfully."
fi

echo -e "\n🔄 Updating dependencies in monorepo..."

# All non-test releases, including pre-releases, will now update dependencies.
# This fixes the root cause of the unclean working directory issue.
while IFS= read -r package_json; do
  if [[ "$package_json" != "./package.json" ]]; then
    PROJECT_DIR=$(dirname "$package_json")
    
    # Check for the literal string "workspace:" to avoid resolving the version.
    if [[ "$package_json" =~ ^.*\/node_modules\/workspace\/.*\/package\.json$ ]]; then
      echo "  └─ Skipping dependency update for workspace package: $PROJECT_DIR"
      continue
    fi

    # Only process if the dependency exists (not {} or empty) and isn't a workspace dependency
    if [[ "$CURRENT_DEP_VERSION" != "{}" && -n "$CURRENT_DEP_VERSION" && "$CURRENT_DEP_VERSION" != workspace:* ]]; then
      # Get relative path for cleaner output
      REL_PATH=$(echo "$package_json" | sed 's/\.\.\///')
      echo "  └─ $REL_PATH"
      if [[ "$DRY_RUN" == true ]]; then
        echo "     [DRY RUN] Update to $NEW_VERSION"
      else
        (cd "$PROJECT_DIR" && sed -i.bak "s/\"$DEPENDENCY_NAME\": \"[^\"]*\"/\"$DEPENDENCY_NAME\": \"$NEW_VERSION\"/" package.json && rm package.json.bak)
      fi
    fi
  fi
done < <(find .. -path "*/node_modules" -prune -o -name "package.json" -print)


echo -e "\n📥 Installing dependencies..."
if [[ "$DRY_RUN" == true ]]; then
  echo "  [DRY RUN] pnpm install --no-frozen-lockfile --ignore-scripts"
else
  # context(justinvdm, 2025-07-16): Sometimes the rwsdk package we just released has not yet become available on the registry, so we retry a few times.
  for i in {1..10}; do
    echo "Attempt $i of 10: Running pnpm install"
    if pnpm install --no-frozen-lockfile --ignore-scripts; then
      break # Success
    fi

    if [ $i -eq 10 ]; then
      echo "pnpm install failed after 10 attempts, exiting"
      exit 1
    fi

    sleep_time=0
    if [ $i -le 3 ]; then
      sleep_time=3
    elif [ $i -le 7 ]; then
      sleep_time=5
    else
      sleep_time=10
    fi

    echo "pnpm install failed, retrying in ${sleep_time}s..."
    sleep $sleep_time
  done
fi

echo -e "\n💾 Committing changes..."
if [[ "$DRY_RUN" == true ]]; then
  echo "  [DRY RUN] Git operations:"
  if [[ "$NEW_VERSION" =~ -.*\. && ! "$NEW_VERSION" =~ -test\. ]]; then
    echo "    - Add: package.json only (prerelease - no dependency updates)"
  else
    echo "    - Add: all package.json and pnpm-lock.yaml files"
  fi
  echo "    - Amend commit: release $NEW_VERSION"
  if [[ "$VERSION_TYPE" == "test" ]]; then
    echo "    - Tag: $TAG_NAME"
    echo "    - Push tag $TAG_NAME to remote"
    echo "    - Reset branch to previous commit (commit will be on remote via tag)"
    echo "    - No branch push will be performed"
  else
    echo "    - Tag: $TAG_NAME"
    echo "    - Push: origin with tags"
  fi
else
  # Add all changed package.json and pnpm-lock.yaml files in the monorepo.
  # This is safe for all cases because `git diff` will only find files that have actually changed.
  # For a prerelease, this will correctly include the updated pnpm-lock.yaml.
  (cd .. && git add $(git diff --name-only | grep -E 'package\.json|pnpm-lock\.yaml$'))
  git commit --amend --no-edit

  if [[ "$VERSION_TYPE" == "test" ]]; then
    echo "  - Creating tag for test release..."
    git tag "$TAG_NAME"
    echo "  - Pushing tag to remote..."
    git push origin "$TAG_NAME"
    echo "  - Rolling back local commit for test release. The commit is available via the remote tag."
    git reset --hard HEAD~1
  else
    # As a final safety measure, check for and discard any remaining unstaged changes
    # This prevents the rebase/push from failing due to an unexpectedly dirty working directory
    if ! git diff-index --quiet HEAD --; then
      echo "::warning::Detected unstaged changes before final push. This should not happen."
      echo "Stashing changes to ensure a clean push:"
      git stash --include-untracked
      git stash drop
    fi
    git tag "$TAG_NAME"
    git push origin main
    git push origin "$TAG_NAME"
  fi
fi

# If we've reached the end of the script, it was successful.
SUCCESS_FLAG=true

if [[ "$DRY_RUN" == true ]]; then
  echo -e "\n✨ Done! Released version $NEW_VERSION (DRY RUN)\n"
else
  echo -e "\n✨ Done! Released version $NEW_VERSION\n"
fi