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
  echo "  [DRY RUN] NODE_ENV=production pnpm build"
else
  NODE_ENV=production pnpm build
fi

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

echo -e "\n🚀 Publishing version $NEW_VERSION..."
if [[ "$DRY_RUN" == true ]]; then
  if [[ "$VERSION_TYPE" == "test" ]]; then
    echo "  [DRY RUN] pnpm publish --tag test"
  else
    echo "  [DRY RUN] pnpm publish"
  fi
else
  PUBLISH_CMD="pnpm publish"
  if [[ "$VERSION_TYPE" == "test" ]]; then
    PUBLISH_CMD="$PUBLISH_CMD --tag test"
  fi
  if ! $PUBLISH_CMD; then
    echo -e "\n❌ Publish failed. Rolling back version commit..."
    git reset --hard HEAD~1
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