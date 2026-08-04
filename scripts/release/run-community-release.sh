#!/bin/bash
# Runs the rwsdk-community package release inside the release container.
#
# Community counterpart of run-in-container.sh — see that file and
# scripts/release-docker.sh for the shared design. This flow is simpler: no
# smoke tests, no browser, no GitHub release; just install, build, version,
# pack, publish (unless dry), then commit/tag/push (unless dry).
#
# 🚨 SECURITY: this must keep running locally in the container, never in
# GitHub Actions — hosted runners expose OIDC tokens and npm credentials.
#
# Expected env:
#   RWSDK_RELEASE_BRANCH   Branch to release from (default: main)
#   RWSDK_RELEASE_SOURCE   "origin" (default) | "local" (dry-run testing)
#   RWSDK_RELEASE_REMOTE_URL  Real GitHub remote URL
#   VERSION_TYPE           patch | minor | major (default: patch)
#   NPM_TOKEN              npm publish token
#   DRY_RUN                true | false (default: false)
set -euo pipefail

RELEASE_BRANCH="${RWSDK_RELEASE_BRANCH:-main}"
RELEASE_SOURCE="${RWSDK_RELEASE_SOURCE:-origin}"
REMOTE_URL="${RWSDK_RELEASE_REMOTE_URL:-https://github.com/redwoodjs/sdk.git}"
VERSION_TYPE="${VERSION_TYPE:-patch}"
DRY_RUN="${DRY_RUN:-false}"

case "$VERSION_TYPE" in
  patch|minor|major) ;;
  *)
    echo "Error: VERSION_TYPE must be patch, minor, or major (got '$VERSION_TYPE')." >&2
    exit 1
    ;;
esac

echo "==> Cloning repository"
# /src-git is the host repo's git dir, mounted read-only. Cloning from it is
# fast (local objects) and gives us a clean, writable workspace that cannot
# touch the maintainer's checkout.
git clone --quiet "file:///src-git" /work/repo
cd /work/repo
git remote set-url origin "$REMOTE_URL"

git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"

echo "==> Resolving release branch: $RELEASE_BRANCH (source: $RELEASE_SOURCE)"
if [[ "$RELEASE_SOURCE" == "origin" ]]; then
  git fetch --quiet origin "$RELEASE_BRANCH" --tags
  git checkout --quiet -B "$RELEASE_BRANCH" "origin/$RELEASE_BRANCH"
else
  git checkout --quiet "$RELEASE_BRANCH"
  git fetch --quiet origin --tags || true
fi

echo "==> Installing dependencies (workspace)"
ulimit -n 65536
pnpm install

echo "==> Setting up .npmrc for publishing"
if [[ -n "${NPM_TOKEN:-}" ]]; then
  {
    echo "registry=https://registry.npmjs.org/"
    echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}"
  } >> community/.npmrc
else
  echo "registry=https://registry.npmjs.org/" >> community/.npmrc
fi

echo "==> Building community package"
(cd community && pnpm build)

cd community
CURRENT_VERSION="$(npm pkg get version | tr -d '"')"

if [[ "$DRY_RUN" == "true" ]]; then
  NEW_VERSION="v$(npx semver -i "$VERSION_TYPE" "$CURRENT_VERSION")"
  echo "==> [DRY RUN] npm version $VERSION_TYPE --no-git-tag-version  ($CURRENT_VERSION -> $NEW_VERSION)"
else
  NEW_VERSION="$(npm version "$VERSION_TYPE" --no-git-tag-version)"
  echo "==> Version bumped: $CURRENT_VERSION -> $NEW_VERSION"
fi

echo "==> Packing community package"
PACK_OUTPUT="$(pnpm pack --pack-destination . --json)"
PACKAGE_FILE="$(PACK_OUTPUT="$PACK_OUTPUT" node -e "const packed = JSON.parse(process.env.PACK_OUTPUT); const entry = Array.isArray(packed) ? packed[0] : packed; if (!entry?.filename) { throw new Error('pnpm pack did not return a filename'); } console.log(entry.filename);")"
echo "  Packed: $PACKAGE_FILE"

echo "==> Publishing $NEW_VERSION"
if [[ "$DRY_RUN" == "true" ]]; then
  echo "  [DRY RUN] npm publish '$PACKAGE_FILE'"
else
  npm publish "$PACKAGE_FILE"
fi

echo "==> Committing, tagging, pushing"
cd /work/repo
if [[ "$DRY_RUN" == "true" ]]; then
  echo "  [DRY RUN] git commit: chore(release): community $NEW_VERSION"
  echo "  [DRY RUN] git tag community-$NEW_VERSION"
  echo "  [DRY RUN] git push origin $RELEASE_BRANCH && git push origin community-$NEW_VERSION"
else
  git add community/package.json
  git commit -m "chore(release): community $NEW_VERSION"
  git tag "community-$NEW_VERSION"
  if command -v gh >/dev/null 2>&1; then
    GH_TOKEN="${GH_TOKEN_FOR_RELEASES:-}" gh auth setup-git >/dev/null 2>&1 || true
  fi
  git push origin "$RELEASE_BRANCH"
  git push origin "community-$NEW_VERSION"
fi

if [[ "$DRY_RUN" == "true" ]]; then
  echo -e "\n✨ Done! Released community $NEW_VERSION (DRY RUN)\n"
else
  echo -e "\n✨ Done! Released community $NEW_VERSION\n"
fi
