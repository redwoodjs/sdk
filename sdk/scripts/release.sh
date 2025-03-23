#!/bin/bash

set -e  # Stop on first error

DEPENDENCY_NAME="@redwoodjs/sdk"  # Replace with the actual package name

show_help() {
  echo "Usage: pnpm release <patch|minor|major|test> [--dry]"
  echo ""
  echo "Automates version bumping, publishing, and dependency updates for $DEPENDENCY_NAME"
  echo ""
  echo "Arguments:"
  echo "  patch|minor|major    The type of version bump to perform"
  echo "  test                 Create a test release (x.y.z-test.n), published under --tag test"
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
  echo "  --dry    Simulate the release process without making changes"
  echo "  --help   Show this help message"
  echo ""
  echo "Examples:"
  echo "  pnpm release patch         # 0.1.0 -> 0.1.1"
  echo "  pnpm release minor         # 0.1.1 -> 0.2.0"
  echo "  pnpm release major         # 0.2.0 -> 1.0.0"
  echo "  pnpm release test          # 1.0.0 -> 1.0.0-test.0 (published as @test)"
  echo "  pnpm release test          # 1.0.0-test.0 -> 1.0.0-test.1 (published as @test)"
  echo "  pnpm release patch --dry   # Show what would happen"
  exit 0
}

validate_args() {
  for arg in "$@"; do
    if [[ "$arg" == --* && "$arg" != "--dry" && "$arg" != "--help" ]]; then
      echo "Error: Unknown flag '$arg'"
      echo "Use --help to see available options"
      echo ""
      show_help  # This will show the help message and exit
    fi
  done
}

# Reorder argument handling
validate_args "$@"

# Initialize DRY_RUN first
DRY_RUN=false
VERSION_TYPE=""

# Process all arguments
for arg in "$@"; do
  if [[ "$arg" == "--help" ]]; then
    show_help
  elif [[ "$arg" == "--dry" ]]; then
    DRY_RUN=true
  elif [[ "$arg" == "patch" || "$arg" == "minor" || "$arg" == "major" || "$arg" == "test" ]]; then
    VERSION_TYPE=$arg
  fi
done

# Validate required arguments
if [[ -z "$VERSION_TYPE" ]]; then
  echo "Error: Version type (patch|minor|major|test) is required"
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
  pnpm install --frozen-lockfile
fi

echo -e "\n🏗️  Building package..."
if [[ "$DRY_RUN" == true ]]; then
  echo "  [DRY RUN] NODE_ENV=production pnpm build"
else
  NODE_ENV=production pnpm build
fi

CURRENT_VERSION=$(npm pkg get version | tr -d '"')
if [[ "$VERSION_TYPE" == "test" ]]; then
  # Check if current version already has a test suffix
  if [[ "$CURRENT_VERSION" =~ ^(.*)-test.([0-9]+)$ ]]; then
    BASE_VERSION="${BASH_REMATCH[1]}"
    TEST_NUM=$((${BASH_REMATCH[2]} + 1))
    NEW_VERSION="$BASE_VERSION-test.$TEST_NUM"
  else
    NEW_VERSION="$CURRENT_VERSION-test.0"
  fi
else
  # If current version is a test version, use the base version for incrementing
  if [[ "$CURRENT_VERSION" =~ ^(.*)-test.([0-9]+)$ ]]; then
    CURRENT_VERSION="${BASH_REMATCH[1]}"
  fi
  NEW_VERSION=$(semver -i $VERSION_TYPE $CURRENT_VERSION)
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
  echo "    - Add: all package.json and pnpm-lock.yaml files"
  echo "    - Amend commit: release $NEW_VERSION"
  echo "    - Tag: $TAG_NAME"
  echo "    - Push: origin with tags"
else
  # Add all changed package.json and pnpm-lock.yaml files in the monorepo
  (cd .. && git add $(git diff --name-only | grep -E 'package\.json|pnpm-lock\.yaml$'))
  git commit --amend --no-edit
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