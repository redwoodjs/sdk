#!/bin/bash

set -e  # Stop on first error

DEPENDENCY_NAME="redwoodsdk"  # Replace with the actual package name

show_help() {
  echo "Usage: pnpm release <patch|minor|major> [--dry]"
  echo ""
  echo "Automates version bumping, publishing, and dependency updates in a monorepo."
  echo ""
  echo "How it works:"
  echo "  - Bumps the version using 'pnpm version' without committing or tagging."
  echo "  - Publishes the package to npm."
  echo "  - If publishing fails, no changes are committed or tagged."
  echo "  - If publishing succeeds:"
  echo "    - Updates monorepo dependencies using this package (if not a workspace dependency)."
  echo "    - Commits all changes, including dependency updates."
  echo "    - Tags the commit with the new version."
  echo "    - Pushes the commit and tag."
  echo ""
  echo "Options:"
  echo "  --dry   Simulate the release process without making actual changes."
  echo "  --help      Show this help message."
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
  elif [[ "$arg" == "patch" || "$arg" == "minor" || "$arg" == "major" ]]; then
    VERSION_TYPE=$arg
  fi
done

# Validate required arguments
if [[ -z "$VERSION_TYPE" ]]; then
  echo "Error: Version type (patch|minor|major) is required"
  echo ""
  show_help
fi

CURRENT_VERSION=$(npm pkg get version | tr -d '"')
NEW_VERSION=$(semver -i $VERSION_TYPE $CURRENT_VERSION)

if [[ "$DRY_RUN" == false ]]; then
  npm version $NEW_VERSION --no-git-tag-version > /dev/null
fi

echo -e "\n📦 Bumping version to $NEW_VERSION ($VERSION_TYPE)..."

TAG_NAME="v$NEW_VERSION"

echo -e "\n🚀 Publishing package..."
if [[ "$DRY_RUN" == true ]]; then
  echo "  [DRY RUN] pnpm publish"
else
  pnpm publish
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
  pnpm install
fi

echo -e "\n💾 Committing changes..."
if [[ "$DRY_RUN" == true ]]; then
  echo "  [DRY RUN] Git operations:"
  echo "    - Add: package.json pnpm-lock.yaml"
  echo "    - Commit: release $NEW_VERSION"
  echo "    - Tag: $TAG_NAME"
  echo "    - Push: origin with tags"
else
  git add package.json pnpm-lock.yaml
  git commit -m "release $NEW_VERSION"
  git tag "$TAG_NAME"
  git push --follow-tags
fi

if [[ "$DRY_RUN" == true ]]; then
  echo -e "\n✨ Done! Released version $NEW_VERSION (DRY RUN)\n"
else
  echo -e "\n✨ Done! Released version $NEW_VERSION\n"
fi