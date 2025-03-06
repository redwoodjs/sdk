#!/bin/bash

set -e  # Stop on first error

DEPENDENCY_NAME="<YOUR_PACKAGE_NAME>"  # Replace with the actual package name
DRY_RUN=false

show_help() {
  echo "Usage: pnpm release <patch|minor|major> [--dry-run]"
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

if [[ "$1" == "--help" || -z "$1" ]]; then
  show_help
fi

if [[ "$1" == "--dry" ]]; then
  DRY_RUN=true
  shift
fi

VERSION_TYPE=$1

echo "Bumping version ($VERSION_TYPE)..."
if [[ "$DRY_RUN" == true ]]; then
  echo "[Dry Run] pnpm version $VERSION_TYPE --no-git-tag-version"
else
  pnpm version $VERSION_TYPE --no-git-tag-version
fi

NEW_VERSION=$(npm pkg get version | tr -d '"')
TAG_NAME="v$NEW_VERSION"

echo "Publishing package..."
if [[ "$DRY_RUN" == true ]]; then
  echo "[Dry Run] pnpm publish"
else
  pnpm publish
fi

echo "Updating monorepo dependencies..."
while IFS= read -r package_json; do
  if [[ "$package_json" != "./package.json" ]]; then
    CURRENT_DEP_VERSION=$(npm pkg get dependencies."$DEPENDENCY_NAME" --prefix "$(dirname "$package_json")" | tr -d '"')

    if [[ -n "$CURRENT_DEP_VERSION" && "$CURRENT_DEP_VERSION" != workspace:* ]]; then
      echo "Updating $package_json to use $NEW_VERSION..."
      if [[ "$DRY_RUN" == true ]]; then
        echo "[Dry Run] npm pkg set dependencies.\"$DEPENDENCY_NAME\"=\"$NEW_VERSION\" --prefix \"$(dirname "$package_json")\""
      else
        npm pkg set dependencies."$DEPENDENCY_NAME"="$NEW_VERSION" --prefix "$(dirname "$package_json")"
      fi
    fi
  fi
done < <(find . -path "*/node_modules" -prune -o -name "package.json" -print)

echo "Committing changes..."
if [[ "$DRY_RUN" == true ]]; then
  echo "[Dry Run] git add package.json pnpm-lock.yaml"
  echo "[Dry Run] git commit -m \"release $NEW_VERSION\""
else
  git add package.json pnpm-lock.yaml
  git commit -m "release $NEW_VERSION"
fi

echo "Tagging release..."
if [[ "$DRY_RUN" == true ]]; then
  echo "[Dry Run] git tag $TAG_NAME"
else
  git tag "$TAG_NAME"
fi

echo "Pushing changes..."
if [[ "$DRY_RUN" == true ]]; then
  echo "[Dry Run] git push --follow-tags"
else
  git push --follow-tags
fi

echo "Done! Released version $NEW_VERSION (Dry Run: $DRY_RUN)."