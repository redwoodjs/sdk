#!/bin/bash
# Runs the rwsdk release inside the release container.
#
# This script is the in-container half of `pnpm release` (see
# scripts/release-docker.sh for the host half). It performs the same steps the
# old agent-ci workflow did, minus the agent-ci machinery (git shim, runner
# agent, injected env): clone the repo, check out the release branch, install,
# build, smoke test via sdk/scripts/release.sh, then optionally publish, push,
# and create the GitHub release.
#
# Expected env (all optional unless noted):
#   RWSDK_RELEASE_BRANCH   Branch to release from (default: main)
#   RWSDK_RELEASE_SOURCE   "origin" = release the remote branch tip (default,
#                          used for real releases) | "local" = use the cloned
#                          local ref as-is (used for dry-run testing of
#                          unmerged branches)
#   RWSDK_RELEASE_REMOTE_URL  Real GitHub remote URL (default: redwoodjs/sdk)
#   VERSION_TYPE           patch | minor | beta | test | canary | explicit
#   VERSION                explicit version (only for VERSION_TYPE=explicit)
#   NPM_TOKEN              npm publish token
#   GH_TOKEN_FOR_RELEASES  GitHub token for release creation and push
#   CREATE_GH_RELEASE      true | false (default: true)
#   SKIP_SMOKE_TESTS       true | false (default: false)
#   DRY_RUN                true | false (default: false)
set -euo pipefail

RELEASE_BRANCH="${RWSDK_RELEASE_BRANCH:-main}"
RELEASE_SOURCE="${RWSDK_RELEASE_SOURCE:-origin}"
REMOTE_URL="${RWSDK_RELEASE_REMOTE_URL:-https://github.com/redwoodjs/sdk.git}"
VERSION_TYPE="${VERSION_TYPE:-patch}"
VERSION="${VERSION:-}"
SKIP_SMOKE_TESTS="${SKIP_SMOKE_TESTS:-false}"
DRY_RUN="${DRY_RUN:-false}"
CREATE_GH_RELEASE="${CREATE_GH_RELEASE:-true}"
OUT_DIR="${RWSDK_RELEASE_OUT_DIR:-/out}"

# Keep a copy of anything the smoke tests preserve on failure, so it can be
# inspected from the host after the container is gone.
copy_failure_artifacts() {
  local ec=$?
  if [[ $ec -ne 0 && -d "$OUT_DIR" ]]; then
    echo "Copying failure artifacts to $OUT_DIR ..."
    mkdir -p "$OUT_DIR"
    for d in /tmp/tmp.* /tmp/rwsdk-e2e/e2e-projects; do
      if [[ -e $d ]]; then
        cp -r "$d" "$OUT_DIR/" 2>/dev/null || true
      fi
    done
  fi
}
trap copy_failure_artifacts EXIT

if [[ "$VERSION" == "none" ]]; then
  VERSION=""
fi

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
  # Releases always come from the remote branch tip, so we never publish a
  # stale or unmerged checkout and then lose the final push to a fetch-first
  # rejection.
  git fetch --quiet origin "$RELEASE_BRANCH" --tags
  git checkout --quiet -B "$RELEASE_BRANCH" "origin/$RELEASE_BRANCH"
else
  git checkout --quiet "$RELEASE_BRANCH"
  git fetch --quiet origin --tags || true
fi

echo "==> Installing dependencies (workspace)"
ulimit -n 65536
pnpm install

echo "==> Installing chromium via the repo's playwright-core"
# context(justinvdm, 2026-08-04): The smoke tests resolve a browser through
# playwright-core's executablePath(), which expects the chromium build that
# matches the repo's playwright-core version. Installing through the repo's
# own playwright-core keeps that true by construction — a hardcoded
# `playwright@X` pin drifted once and silently sent us down the
# @puppeteer/browsers fallback, which ships no linux arm64 binary.
(cd sdk && pnpm exec playwright-core install --with-deps chromium)

echo "==> Setting up .npmrc for publishing"
if [[ -n "${NPM_TOKEN:-}" ]]; then
  {
    echo "registry=https://registry.npmjs.org/"
    echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}"
  } >> sdk/.npmrc
fi

# release.sh writes TAG_NAME to $GITHUB_ENV; point it at a real file so we can
# read the tag back for the GitHub release step below.
export GITHUB_ENV=/tmp/github-env
: > "$GITHUB_ENV"

COMMAND="./scripts/release.sh $VERSION_TYPE"
if [[ -n "$VERSION" ]]; then
  COMMAND="$COMMAND --version $VERSION"
fi
if [[ "$SKIP_SMOKE_TESTS" == "true" ]]; then
  COMMAND="$COMMAND --skip-smoke-tests"
fi
if [[ "$DRY_RUN" == "true" ]]; then
  COMMAND="$COMMAND --dry"
fi

echo "==> Running release: $COMMAND (branch: $RELEASE_BRANCH)"
(
  cd sdk
  export CI=1
  export GITHUB_ACTIONS=1
  export GITHUB_EVENT_NAME=pull_request
  export GH_TOKEN="${GH_TOKEN_FOR_RELEASES:-}"
  export RWSDK_RELEASE_BRANCH="$RELEASE_BRANCH"
  export RWSDK_RELEASE_CONTAINER=1
  eval "$COMMAND"
)

if [[ "${CREATE_GH_RELEASE}" == "false" ]]; then
  echo "Skipping GitHub release creation as requested."
  exit 0
fi
if [[ "${DRY_RUN}" == "true" ]]; then
  echo "Skipping GitHub release creation for dry run."
  exit 0
fi

TAG_NAME="$(grep '^TAG_NAME=' "$GITHUB_ENV" | tail -n1 | cut -d= -f2-)"
if [[ -z "$TAG_NAME" ]]; then
  echo "ERROR: TAG_NAME was not recorded by the release script." >&2
  exit 1
fi

FLAGS="--generate-notes"
if [[ "$VERSION_TYPE" == "patch" || "$VERSION_TYPE" == "minor" || "$VERSION_TYPE" == "beta" ]]; then
  FLAGS="$FLAGS --latest"
elif [[ "$VERSION_TYPE" == "explicit" ]]; then
  # For explicit versions, we check the version string to determine if it's a pre-release
  if [[ "$VERSION" == *"-beta."* ]]; then
    FLAGS="$FLAGS --latest"
  elif [[ "$VERSION" == *"-"* ]]; then
    FLAGS="$FLAGS --prerelease"
  else
    FLAGS="$FLAGS --latest"
  fi
elif [[ "$VERSION_TYPE" == "test" || "$VERSION_TYPE" == "canary" ]]; then
  FLAGS="$FLAGS --prerelease"
fi

if [[ "$VERSION_TYPE" == "canary" ]]; then
  # context(justinvdm, 2026-06-04): canary notes should compare against the previous canary tag so the
  # public "What's changed" section stays on the same prerelease line.
  BASE_TAG="${TAG_NAME#v}"
  BASE_TAG="${BASE_TAG%-canary.*}"
  PREVIOUS_CANARY_TAG=""
  mapfile -t CANARY_TAGS < <(git tag --list "v${BASE_TAG}-canary.*" --sort=-v:refname)
  for CANDIDATE_TAG in "${CANARY_TAGS[@]}"; do
    if [[ "$CANDIDATE_TAG" != "$TAG_NAME" ]]; then
      PREVIOUS_CANARY_TAG="$CANDIDATE_TAG"
      break
    fi
  done
  if [[ -n "$PREVIOUS_CANARY_TAG" ]]; then
    FLAGS="$FLAGS --notes-start-tag $PREVIOUS_CANARY_TAG"
  fi
fi

REPO="$REMOTE_URL"
case "$REPO" in
  https://github.com/*)
    REPO="${REPO#https://github.com/}"
    REPO="${REPO%.git}"
    ;;
  git@github.com:*)
    REPO="${REPO#git@github.com:}"
    REPO="${REPO%.git}"
    ;;
  *)
    REPO="${GITHUB_REPOSITORY:-redwoodjs/sdk}"
    ;;
esac

echo "==> Creating GitHub release for $REPO tag $TAG_NAME with flags: $FLAGS"
GH_TOKEN="${GH_TOKEN_FOR_RELEASES:-}" gh --repo "$REPO" release create "$TAG_NAME" $FLAGS
