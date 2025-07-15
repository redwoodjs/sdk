#!/bin/bash

set -e  # Stop on first error

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
  echo "  1. Builds package with NODE_ENV=production"
  echo "  2. Calculates new version using semver"
  echo "  3. Updates package.json with new version"
  echo "  4. Commits version change"
  echo "  5. Publishes package to npm"
  echo "  6. On successful publish:"
  echo "     - Updates dependent packages in the monorepo"
  echo "     - Runs pnpm install to update lockfile"
  echo "     - Amends initial commit with dependency updates"
  echo "     - Tags the commit"
  echo "     - Pushes to origin"
  echo "  7. On failed publish:"
  echo "     - Reverts version commit"
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
  echo "  [DRY RUN] NOTE: Running build to allow for artifact verification."
else
  NODE_ENV=production pnpm build
fi

echo -e "\n🔍 Verifying build artifacts..."
if [[ "$DRY_RUN" == true ]]; then
  echo "  [DRY RUN] Running verification checks..."
fi
# This check runs in both normal and dry-run modes.

# Count all relevant source files
SRC_COUNT=$(find src -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.mts" -o -name "*.mjs" \) \
  -not -path '*/__snapshots__/*' \
  -not -name '.DS_Store' \
  | wc -l)

# Count all generated JS files
DIST_JS_COUNT=$(find dist -type f \( -name "*.js" -o -name "*.mjs" \) | wc -l)
# Count all generated declaration files
DIST_DTS_COUNT=$(find dist -type f \( -name "*.d.ts" -o -name "*.d.mts" \) | wc -l)

# Count the test files we expect to be in the source
SRC_TEST_COUNT=$(find src -type f \( -name "*.test.ts" -o -name "*.test.mts" -o -name "*.typetest.ts" \) | wc -l)

# The number of generated files should equal the number of source files,
# minus the test files (since they don't all generate corresponding files
# in the same way, and we are excluding them from our final check).
# This is not perfect, but it's a much closer approximation.
# The core logic is: (Total JS files) - (Total Source Files) should equal (Test files)
JS_DIFF=$((DIST_JS_COUNT - SRC_COUNT))
DTS_DIFF=$((DIST_DTS_COUNT - (SRC_COUNT - 1))) # -1 for the .mjs file with no .d.mts

echo "  - Source files (total): $SRC_COUNT"
echo "  - Source test files: $SRC_TEST_COUNT"
echo "  - Generated JS files (total): $DIST_JS_COUNT"
echo "  - Generated Declaration files (total): $DIST_DTS_COUNT"
echo "  - Calculated JS difference (should be close to test count): $JS_DIFF"
echo "  - Calculated Declaration difference (should be close to test count): $DTS_DIFF"

if [[ "$JS_DIFF" -ne "$SRC_TEST_COUNT" ]]; then
    echo "  ❌ Mismatch in JS file count. The difference ($JS_DIFF) does not match the source test count ($SRC_TEST_COUNT)."
    exit 1
fi

if [[ "$DTS_DIFF" -ne "$SRC_TEST_COUNT" ]]; then
    echo "  ❌ Mismatch in Declaration file count. The difference ($DTS_DIFF) does not match the source test count ($SRC_TEST_COUNT)."
    exit 1
fi

echo "  ✅ Build artifacts verified successfully."


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

echo -e "\n📦 Packing package..."
if [[ "$DRY_RUN" == true ]]; then
  echo "  [DRY RUN] npm pack"
  # Construct a plausible tarball name for dry run
  PACKAGE_NAME_FOR_TARBALL=$(npm pkg get name | tr -d '"' | sed 's/@//; s/\//-/')
  TARBALL_NAME="$PACKAGE_NAME_FOR_TARBALL-$NEW_VERSION.tgz"
  echo "  [DRY RUN] Tarball name: $TARBALL_NAME"
else
  # npm pack creates the tarball and prints its name to stdout
  TARBALL_NAME=$(npm pack)
  if [ ! -f "$TARBALL_NAME" ]; then
    echo "❌ npm pack failed to create tarball"
    exit 1
  fi
  echo "  ✅ Packed to $TARBALL_NAME"
fi

echo -e "\n🔬 Smoke testing package..."
if [[ "$DRY_RUN" == true ]]; then
  echo "  [DRY RUN] Skipping smoke tests."
else
  TEMP_DIR=$(mktemp -d)
  echo "  - Created temp dir for testing: $TEMP_DIR"

  # On exit, ensure temp dir and tarball are cleaned up. We use a trap that will
  # fire on EXIT, whether it's successful or due to an error.
  trap 'echo "  - Cleaning up..."; rm -rf "$TEMP_DIR"; rm -f "$TARBALL_NAME"' EXIT

  echo "  - Copying minimal starter to temp dir..."
  # We are in sdk/sdk, starter is in ../../starters/minimal
  cp -a ../../starters/minimal/. "$TEMP_DIR/"

  # The tarball is in the current directory (sdk/sdk)
  TARBALL_PATH="$PWD/$TARBALL_NAME"

  echo "  - Installing packed tarball in temp dir..."
  (cd "$TEMP_DIR" && npm install "$TARBALL_PATH" --no-save)

  PACKAGE_NAME=$(npm pkg get name | tr -d '"')
  INSTALLED_DIST_PATH="$TEMP_DIR/node_modules/$PACKAGE_NAME/dist"

  echo "  - Verifying installed package contents..."
  if [ ! -d "$INSTALLED_DIST_PATH" ]; then
      echo "  ❌ Error: dist/ directory not found in installed package at $INSTALLED_DIST_PATH."
      exit 1
  fi

  # To ensure the package is built and packed correctly, we'll compare
  # a checksum of the file lists from the original `dist` directory and the
  # one installed from the tarball. They must match exactly.
  ORIGINAL_DIST_CHECKSUM=$(find dist -type f | sort | md5sum)
  INSTALLED_DIST_CHECKSUM=$(find "$INSTALLED_DIST_PATH" -type f | sort | md5sum)

  echo "    - Original dist checksum: $ORIGINAL_DIST_CHECKSUM"
  echo "    - Installed dist checksum: $INSTALLED_DIST_CHECKSUM"

  if [[ "$ORIGINAL_DIST_CHECKSUM" != "$INSTALLED_DIST_CHECKSUM" ]]; then
    echo "  ❌ Error: File list in installed dist/ does not match original dist/."
    echo "  This indicates an issue with the build or packaging process."
    exit 1
  else
    echo "  ✅ Installed package contents match the local build."
  fi

  echo "  - Running smoke tests in temp dir..."
  (
    cd "$TEMP_DIR"
    if ! npx rw-scripts smoke-tests; then
      echo "  ❌ Smoke tests failed."
      exit 1
    fi
  )
  echo "  ✅ Smoke tests passed."
fi

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
  for i in {1..3}; do
    echo "Attempt $i of 3: Running pnpm install"
    pnpm install --ignore-scripts && break
    if [ $i -lt 3 ]; then
      echo "pnpm install failed, retrying in 3 seconds..."
      sleep 3
    else
      echo "pnpm install failed after 3 attempts, exiting"
      exit 1
    fi
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

if [[ "$DRY_RUN" == true ]]; then
  echo -e "\n✨ Done! Released version $NEW_VERSION (DRY RUN)\n"
else
  echo -e "\n✨ Done! Released version $NEW_VERSION\n"
fi