#!/bin/bash

set -e  # Stop on first error

SUCCESS_FLAG=false # Default to failure. This will be checked by the cleanup trap.

DEPENDENCY_NAME="rwsdk"  # Replace with the actual package name

show_help() {
  echo "Usage: pnpm release <patch|minor|beta|test|explicit> [--version <string>] [--dry]"
  echo
  echo "Automates version bumping, publishing, and dependency updates for $DEPENDENCY_NAME."
  echo "For safety, only 'patch', 'minor', 'beta', and 'test' bumps can be calculated automatically."
  echo "To release a major or pre-release version, you MUST use the 'explicit' version_type and provide the exact version string with '--version'."
  echo
  echo "Arguments:"
  echo "  patch|minor|beta|test    Calculates the next version of this type automatically."
  echo "  explicit                 Requires the '--version' flag to specify the exact version to release."
  echo ""
  echo "Process:"
  echo "  1.  Calculates new version (for patch/minor/beta/test) or uses the manual version (for explicit), and updates package.json."
  echo "  2.  Commits the version change."
  echo "  3.  Builds the package with NODE_ENV=production."
  echo "  4.  Bundles the package into a .tgz tarball using \`npm pack\`."
  echo "  5.  Performs a comprehensive smoke test on the packed tarball:"
  echo "      - Verifies the packed \`dist\` contents match the local build via checksum."
  echo "      - Runs \`npx rw-scripts smoke-tests\` in a temporary project."
  echo "  6.  If smoke tests pass, publishes the .tgz tarball to npm (beta versions use --tag latest, other prereleases use --tag pre, test builds use --tag test)."
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
  echo "  pnpm release beta                     # 1.0.0-beta.27 -> 1.0.0-beta.28"
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
    patch|minor|beta|test|explicit)
      VERSION_TYPE=$arg
      ;;
  esac
  i=$((i + 1))
done

# Sanitize version input
if [[ -n "$MANUAL_VERSION" && "$MANUAL_VERSION" == v* ]]; then
  echo "Sanitizing version input: stripping leading 'v' from '$MANUAL_VERSION'"
  MANUAL_VERSION="${MANUAL_VERSION#v}"
  echo "Sanitized version: '$MANUAL_VERSION'"
fi

# Validate required arguments
if [[ -z "$VERSION_TYPE" ]]; then
  echo "Error: Version type (patch|minor|beta|test|explicit) is required."
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

# Validate that patch/minor/major cannot be used when currently in a pre-release (excluding test)
if [[ "$VERSION_TYPE" == "patch" || "$VERSION_TYPE" == "minor" || "$VERSION_TYPE" == "major" ]]; then
  if [[ "$CURRENT_VERSION" == *"-"* && "$CURRENT_VERSION" != *"-test."* ]]; then
    echo "Error: Cannot use '$VERSION_TYPE' version type when current version is a pre-release ($CURRENT_VERSION)."
    echo "To release a major version after a pre-release, use 'explicit' version type and specify the exact version."
    exit 1
  fi
fi

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
elif [[ "$VERSION_TYPE" == "beta" ]]; then
  # Handle beta version bumping: 1.0.0-beta.27 -> 1.0.0-beta.28
  if [[ "$CURRENT_VERSION" =~ ^(.*)-beta\.([0-9]+)$ ]]; then
    BASE_VERSION="${BASH_REMATCH[1]}"
    BETA_NUMBER="${BASH_REMATCH[2]}"
    NEW_BETA_NUMBER=$((BETA_NUMBER + 1))
    NEW_VERSION="$BASE_VERSION-beta.$NEW_BETA_NUMBER"
  else
    echo "Error: Current version '$CURRENT_VERSION' is not a beta version. Beta bump requires a version in the format X.Y.Z-beta.N"
    exit 1
  fi
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

  echo "  - Running smoke tests..."
  # The CWD is the package root (sdk/sdk), so we can run pnpm smoke-test directly.
  # We also specify an artifact directory *within* the temp directory.
  # todo(justinvdm, 11 Aug 2025): Fix style test flakiness
  # Pass the tarball path to the smoke test environment
  export RWSKD_SMOKE_TEST_TARBALL_PATH="$TARBALL_PATH"
  if ! pnpm smoke-test --artifact-dir="$TEMP_DIR/artifacts" --skip-style-tests; then
    echo "  ❌ Smoke tests failed."
    exit 1
  fi
  echo "  ✅ Smoke tests passed."
fi

echo -e "\n🚀 Publishing version $NEW_VERSION..."
if [[ "$DRY_RUN" == true ]]; then
  if [[ "$VERSION_TYPE" == "test" ]]; then
    echo "  [DRY RUN] npm publish '$TARBALL_PATH' --tag test"
  elif [[ "$NEW_VERSION" == *"-beta."* ]]; then
    echo "  [DRY RUN] npm publish '$TARBALL_PATH' --tag latest"
  elif [[ "$NEW_VERSION" == *"-"* ]]; then
    echo "  [DRY RUN] npm publish '$TARBALL_PATH' --tag pre"
  else
    echo "  [DRY RUN] npm publish '$TARBALL_PATH'"
  fi
else
  PUBLISH_CMD="npm publish \"$TARBALL_PATH\""
  if [[ "$VERSION_TYPE" == "test" ]]; then
    PUBLISH_CMD="$PUBLISH_CMD --tag test"
  elif [[ "$NEW_VERSION" == *"-beta."* ]]; then
    PUBLISH_CMD="$PUBLISH_CMD --tag latest"
  elif [[ "$NEW_VERSION" == *"-"* ]]; then
    # Other pre-releases should use the 'pre' dist-tag
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

echo -e "\n💾 Pushing commit and tag..."
if [[ "$DRY_RUN" == true ]]; then
  echo "  [DRY RUN] Git operations:"
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