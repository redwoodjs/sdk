#!/bin/bash

set -e  # Stop on first error

SUCCESS_FLAG=false # Default to failure. This will be checked by the cleanup trap.

DEPENDENCY_NAME="rwsdk"  # Replace with the actual package name

show_help() {
  echo "Usage: pnpm release <patch|minor|major|prepatch|preminor|premajor|test> [--preid <identifier>] [--dry]"
  echo ""
  echo "Automates version bumping, publishing, and dependency updates for $DEPENDENCY_NAME"
  echo ""
  echo "Arguments:"
  echo "  patch|minor|major    The type of version bump to perform"
  echo "  prepatch             Create a prerelease patch (x.y.z -> x.y.(z+1)-<preid>.0)"
  echo "  preminor             Create a prerelease minor (x.y.z -> x.(y+1).0-<preid>.0)"
  echo "  premajor             Create a prerelease major (x.y.z -> (x+1).0.0-<preid>.0)"
  echo "  test                 Create a test release (x.y.z-test.<timestamp>), published under --tag test"
  echo ""
  echo "Process:"
  echo "  1.  Calculates new version using semver and updates package.json."
  echo "  2.  Commits the version change."
  echo "  3.  Builds the package with NODE_ENV=production."
  echo "  4.  Bundles the package into a .tgz tarball using \`npm pack\`."
  echo "  5.  Performs a comprehensive smoke test on the packed tarball:"
  echo "      - Verifies the packed \`dist\` contents match the local build via checksum."
  echo "      - Runs \`npx rw-scripts smoke-tests\` in a temporary project."
  echo "  6.  If smoke tests pass, publishes the .tgz tarball to npm."
  echo "  7.  On successful publish (for non-prereleases):"
  echo "      - Updates dependencies in the monorepo."
  echo "      - Amends the initial commit with dependency updates."
  echo "      - Tags the commit and pushes to the remote repository."
  echo "  8.  On failure (publish or smoke test):"
  echo "      - The version commit is reverted."
  echo "      - Temporary files are cleaned up."
  echo ""
  echo "Options:"
  echo "  --preid <id>  Prerelease identifier (default: alpha). Used with prepatch/preminor/premajor"
  echo "  --dry         Simulate the release process without making changes"
  echo "  --help        Show this help message"
  echo ""
  echo "Examples:"
  echo "  pnpm release patch                    # 0.1.0 -> 0.1.1"
  echo "  pnpm release minor                    # 0.1.1 -> 0.2.0"
  echo "  pnpm release major                    # 0.2.0 -> 1.0.0"
  echo "  pnpm release preminor                 # 0.0.80 -> 0.1.0-alpha.0"
  echo "  pnpm release preminor --preid beta    # 0.0.80 -> 0.1.0-beta.0"
  echo "  pnpm release prepatch --preid rc      # 0.1.0 -> 0.1.1-rc.0"
  echo "  pnpm release test                     # 1.0.0 -> 1.0.0-test.0 (published as @test)"
  echo "  pnpm release patch --dry              # Show what would happen"
  exit 0
}

validate_args() {
  for arg in "$@"; do
    if [[ "$arg" == --* && "$arg" != "--dry" && "$arg" != "--help" && "$arg" != "--preid" ]]; then
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
PREID="alpha"

# Process all arguments
i=1
for arg in "$@"; do
  if [[ "$arg" == "--help" ]]; then
    show_help
  elif [[ "$arg" == "--dry" ]]; then
    DRY_RUN=true
  elif [[ "$arg" == "--preid" ]]; then
    # Get the next argument as the preid value
    i=$((i + 1))
    eval "PREID=\${$i}"
    if [[ -z "$PREID" ]]; then
      echo "Error: --preid requires a value"
      echo ""
      show_help
    fi
  elif [[ "$arg" == "patch" || "$arg" == "minor" || "$arg" == "major" || "$arg" == "prepatch" || "$arg" == "preminor" || "$arg" == "premajor" || "$arg" == "test" ]]; then
    VERSION_TYPE=$arg
  fi
  i=$((i + 1))
done

# Validate required arguments
if [[ -z "$VERSION_TYPE" ]]; then
  echo "Error: Version type (patch|minor|major|prepatch|preminor|premajor|test) is required"
  echo ""
  show_help
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
if [[ "$VERSION_TYPE" == "test" ]]; then
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
elif [[ "$VERSION_TYPE" == "prepatch" || "$VERSION_TYPE" == "preminor" || "$VERSION_TYPE" == "premajor" ]]; then
  # Handle prerelease versions with explicit preid
  if [[ "$CURRENT_VERSION" =~ ^.*-${PREID}\..*$ ]]; then
    # Check if this is a test version with the same preid
    if [[ "$CURRENT_VERSION" =~ ^(.*-${PREID}\.[0-9]+)-test\..*$ ]]; then
      # Extract base prerelease version and increment it
      BASE_PRERELEASE_VERSION="${BASH_REMATCH[1]}"
      NEW_VERSION=$(npx semver -i prerelease "$BASE_PRERELEASE_VERSION")
    else
      # If current version is already the same prerelease type, increment it
      NEW_VERSION=$(npx semver -i prerelease "$CURRENT_VERSION")
    fi
  else
    # Create new prerelease with the specified type and preid
    NEW_VERSION=$(npx semver -i "$VERSION_TYPE" --preid "$PREID" "$CURRENT_VERSION")
  fi
else
  # Handle regular versions (patch, minor, major)
  # If current version is a prerelease, use the base version for incrementing
  if [[ "$CURRENT_VERSION" =~ ^(.*)-.*$ ]]; then
    CURRENT_VERSION="${BASH_REMATCH[1]}"
  fi
  NEW_VERSION=$(npx semver -i $VERSION_TYPE $CURRENT_VERSION)
fi

echo -e "\n📦 Planning version bump to $NEW_VERSION ($VERSION_TYPE)..."
if [[ "$DRY_RUN" == true ]]; then
  echo "  [DRY RUN] npm pkg set version=$NEW_VERSION"
  echo "  [DRY RUN] Git commit version change"
else
  npm pkg set version="$NEW_VERSION"
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
# Always pack the package to allow for smoke testing, even in a dry run.
# The trap will clean up the tarball.
TARBALL_NAME=$(npm pack)
if [ ! -f "$TARBALL_NAME" ]; then
  echo "❌ npm pack failed to create tarball"
  exit 1
fi
echo "  ✅ Packed to $TARBALL_NAME"

echo -e "\n🔬 Smoke testing package..."
# The smoke test runs in both normal and dry-run modes.

# This cleanup function will be called on EXIT.
# It checks if the script is finishing successfully or not.
cleanup() {
  # If the script did not complete successfully, preserve assets for inspection.
  if [[ "$SUCCESS_FLAG" == false ]]; then
    echo -e "\n❌ A failure occurred. Preserving temp directory for inspection:"
    echo "  - Temp directory: $PROJECT_DIR"
  else
    # Otherwise (on success), clean up the temp dir.
    if [[ -n "$PROJECT_DIR" && -d "$PROJECT_DIR" ]]; then
      echo "  - Cleaning up temp directory..."
      rm -rf "$PROJECT_DIR"
    fi
  fi

  # Always clean up the tarball, regardless of success, failure, or dry run.
  if [[ -n "$TARBALL_NAME" && -f "$TARBALL_NAME" ]]; then
    echo "  - Cleaning up package tarball $TARBALL_NAME..."
    rm -f "$TARBALL_NAME"
  fi
}

TEMP_DIR=$(mktemp -d)
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

# The tarball is in the current directory (sdk/sdk)
TARBALL_PATH="$PWD/$TARBALL_NAME"

echo "  - Installing packed tarball in project dir..."
# Starters don't have a lockfile. In CI, pnpm defaults to --frozen-lockfile.
# We explicitly use `pnpm install --no-frozen-lockfile` to bypass this for the temp starter project.
(cd "$PROJECT_DIR" && pnpm install "$TARBALL_PATH" --no-save --no-frozen-lockfile)

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
if ! pnpm smoke-test --path="$PROJECT_DIR" --no-sync; then
  echo "  ❌ Smoke tests failed."
  exit 1
fi
echo "  ✅ Smoke tests passed."

echo -e "\n🚀 Publishing version $NEW_VERSION..."
if [[ "$DRY_RUN" == true ]]; then
  if [[ "$VERSION_TYPE" == "test" ]]; then
    echo "  [DRY RUN] pnpm publish $TARBALL_NAME --tag test"
  else
    echo "  [DRY RUN] pnpm publish $TARBALL_NAME"
  fi
else
  PUBLISH_CMD="pnpm publish \"$TARBALL_NAME\""
  if [[ "$VERSION_TYPE" == "test" ]]; then
    PUBLISH_CMD="$PUBLISH_CMD --tag test"
  fi
  if ! eval $PUBLISH_CMD; then
    echo -e "\n❌ Publish failed. Rolling back version commit..."
    git reset --hard HEAD~1
    # The trap will clean up the tarball
    exit 1
  fi
fi

echo -e "\n🔄 Updating dependencies in monorepo..."

# Skip dependency updates for prerelease versions (but allow test releases)
if [[ "$NEW_VERSION" =~ -.*\. && ! "$NEW_VERSION" =~ -test\. ]]; then
  echo "  ⏭️  Skipping dependency updates for prerelease version $NEW_VERSION"
else
  while IFS= read -r package_json; do
    if [[ "$package_json" != "./package.json" ]]; then
      PROJECT_DIR=$(dirname "$package_json")
      CURRENT_DEP_VERSION=$(cd "$PROJECT_DIR" && npm pkg get dependencies."$DEPENDENCY_NAME" | tr -d '"')
      
      # Only process if the dependency exists (not {} or empty) and isn't a workspace dependency
      if [[ "$CURRENT_DEP_VERSION" != "{}" && -n "$CURRENT_DEP_VERSION" && "$CURRENT_DEP_VERSION" != workspace:* ]]; then
        # Get relative path for cleaner output
        REL_PATH=$(echo "$package_json" | sed 's/\.\.\///')
        echo "  └─ $REL_PATH"
        if [[ "$DRY_RUN" == true ]]; then
          echo "     [DRY RUN] Update to $NEW_VERSION"
        else
          (cd "$PROJECT_DIR" && npm pkg set dependencies."$DEPENDENCY_NAME"="$NEW_VERSION")
        fi
      fi
    fi
  done < <(find .. -path "*/node_modules" -prune -o -name "package.json" -print)
fi

echo -e "\n📥 Installing dependencies..."
if [[ "$DRY_RUN" == true ]]; then
  echo "  [DRY RUN] pnpm install"
else
  for i in {1..10}; do
    echo "Attempt $i of 10: Running pnpm install"
    if pnpm install --ignore-scripts; then
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
  echo "    - Tag: $TAG_NAME"
  echo "    - Push: origin with tags"
else
  # For prerelease versions, only add the main package.json since we didn't update dependencies
  if [[ "$NEW_VERSION" =~ -.*\. && ! "$NEW_VERSION" =~ -test\. ]]; then
    # Just amend the existing commit (which already has package.json)
    git commit --amend --no-edit
  else
    # Add all changed package.json and pnpm-lock.yaml files in the monorepo
    (cd .. && git add $(git diff --name-only | grep -E 'package\.json|pnpm-lock\.yaml$'))
    git commit --amend --no-edit
  fi
  git pull --rebase
  git tag "$TAG_NAME"
  git push
  git push --tags
fi

# If we've reached the end of the script, it was successful.
SUCCESS_FLAG=true

if [[ "$DRY_RUN" == true ]]; then
  echo -e "\n✨ Done! Released version $NEW_VERSION (DRY RUN)\n"
else
  echo -e "\n✨ Done! Released version $NEW_VERSION\n"
fi
fi