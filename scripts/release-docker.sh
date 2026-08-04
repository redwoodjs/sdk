#!/bin/bash
# Host entrypoint for rwsdk releases: runs the release inside a plain Docker
# container (see scripts/release/Dockerfile and scripts/release/run-in-container.sh).
#
# Releases must run on a maintainer's machine, not in GitHub Actions: hosted
# runners expose OIDC tokens and npm credentials, and a poisoned cache or
# compromised action could publish malicious packages. Running the release in
# a local container keeps that property while remaining reproducible and
# debuggable with plain `docker`.
#
# Usage: pnpm release <patch|minor|beta|test|canary|explicit> [--version <v>] [--dry] [--skip-smoke-tests] [--no-create-gh-release]
#
# Environment:
#   NPM_TOKEN                 npm publish token (default: read from ~/.npmrc)
#   GH_TOKEN_FOR_RELEASES     GitHub token (default: `gh auth token`)
#   RWSDK_RELEASE_SOURCE       "origin" (default; release the remote branch tip)
#                             or "local" (dry-run testing of unmerged branches)
#   RWSDK_RELEASE_IMAGE_REBUILD  set to 1 to force a rebuild of the image
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

IMAGE="rwsdk-release:local"

if [[ " $* " == *" --help "* ]]; then
  cd sdk
  ./scripts/release.sh --help
  exit 0
fi

VERSION_TYPE=""
VERSION=""
CREATE_GH_RELEASE="${CREATE_GH_RELEASE:-true}"
SKIP_SMOKE_TESTS="${SKIP_SMOKE_TESTS:-false}"
DRY_RUN="${DRY_RUN:-false}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry|--dry-run)
      DRY_RUN="true"
      CREATE_GH_RELEASE="false"
      ;;
    --skip-smoke-tests)
      SKIP_SMOKE_TESTS="true"
      ;;
    --no-create-gh-release)
      CREATE_GH_RELEASE="false"
      ;;
    --version)
      shift
      VERSION="${1:-}"
      ;;
    patch|minor|beta|test|canary|explicit)
      if [[ -z "$VERSION_TYPE" ]]; then
        VERSION_TYPE="$1"
      elif [[ -z "$VERSION" && "$VERSION_TYPE" == "explicit" ]]; then
        VERSION="$1"
      fi
      ;;
    *)
      if [[ -z "$VERSION_TYPE" && "$1" != -* ]]; then
        VERSION_TYPE="$1"
      elif [[ -z "$VERSION" && "$VERSION_TYPE" == "explicit" && "$1" != -* ]]; then
        VERSION="$1"
      fi
      ;;
  esac
  shift || true
done

if [[ -z "$VERSION_TYPE" ]]; then
  VERSION_TYPE="patch"
fi
if [[ -z "$VERSION" ]]; then
  VERSION="none"
fi

CURRENT_BRANCH="$(git branch --show-current 2>/dev/null || true)"
if [[ -z "$CURRENT_BRANCH" ]]; then
  CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
fi
if [[ -z "$CURRENT_BRANCH" ]]; then
  CURRENT_BRANCH="HEAD"
fi

CURRENT_SHA="$(git rev-parse HEAD 2>/dev/null || true)"
CURRENT_REMOTE_URL="$(git remote get-url origin 2>/dev/null || true)"

if [[ -z "${NPM_TOKEN:-}" ]]; then
  USER_NPMRC="$(npm config get userconfig 2>/dev/null || true)"
  if [[ -n "$USER_NPMRC" && -f "$USER_NPMRC" ]]; then
    NPM_TOKEN="$(grep -E '^[[:space:]]*//registry\.npmjs\.org/:_authToken=' "$USER_NPMRC" | tail -n1 | sed 's/.*=//')"
  else
    NPM_TOKEN=""
  fi
fi

if [[ -z "${GH_TOKEN_FOR_RELEASES:-}" ]]; then
  if command -v gh >/dev/null 2>&1; then
    GH_TOKEN_FOR_RELEASES="$(gh auth token 2>/dev/null || true)"
  fi
fi
if [[ "$GH_TOKEN_FOR_RELEASES" == "null" ]]; then
  GH_TOKEN_FOR_RELEASES=""
fi

# The container clones from the repo's shared git dir (works from the main
# checkout and from any worktree), so local checkouts are never mutated.
GIT_COMMON_DIR="$(cd "$(git rev-parse --git-common-dir)" && pwd)"

OUT_DIR="$(pwd)/.release-out"
mkdir -p "$OUT_DIR"

if [[ -z "$(docker images -q "$IMAGE" 2>/dev/null)" || "${RWSDK_RELEASE_IMAGE_REBUILD:-}" == "1" ]]; then
  echo "Building release image $IMAGE ..."
  docker build -t "$IMAGE" -f "$SCRIPT_DIR/release/Dockerfile" "$SCRIPT_DIR/release"
fi

DOCKER_ARGS=(
  --rm
  # context(justinvdm, 2026-08-04): OrbStack's VM disk is btrfs, and its
  # transaction-commit writeback stalls block processes doing disk I/O for
  # seconds at a time (measured: workerd parked in D state inside
  # write_all_supers; vite cold dev start 80-96s on btrfs vs 7s on tmpfs,
  # root renders 38s/HTTP 500 vs 41ms/HTTP 200). Everything latency-critical
  # in the smoke tests (temp projects, .vite optimizer state, miniflare's
  # sqlite state, the packed tarball, artifacts) lives under /tmp, so back
  # /tmp with RAM. The size is a cap; tmpfs allocates lazily and can swap.
  # `exec` is required because docker mounts tmpfs noexec by default, which
  # breaks the native binaries the install runs (esbuild, workerd).
  --tmpfs "/tmp:exec,size=4g"
  --mount "type=bind,src=$GIT_COMMON_DIR,dst=/src-git,readonly"
  --mount "type=bind,src=$SCRIPT_DIR/release/run-in-container.sh,dst=/scripts/run-in-container.sh,readonly"
  --mount "type=bind,src=$OUT_DIR,dst=/out"
  --mount "type=volume,src=rwsdk-release-pnpm-store,dst=/root/.local/share/pnpm/store"
  --mount "type=volume,src=rwsdk-release-playwright,dst=/root/.cache/ms-playwright"
  --mount "type=volume,src=rwsdk-release-corepack,dst=/root/.cache/node/corepack"
  --env "NPM_TOKEN=$NPM_TOKEN"
  --env "GH_TOKEN_FOR_RELEASES=$GH_TOKEN_FOR_RELEASES"
  --env "RWSDK_RELEASE_BRANCH=$CURRENT_BRANCH"
  --env "RWSDK_RELEASE_SHA=$CURRENT_SHA"
  --env "RWSDK_RELEASE_REMOTE_URL=$CURRENT_REMOTE_URL"
  --env "RWSDK_RELEASE_SOURCE=${RWSDK_RELEASE_SOURCE:-origin}"
  --env "RWSDK_RELEASE_OUT_DIR=/out"
  --env "VERSION_TYPE=$VERSION_TYPE"
  --env "VERSION=$VERSION"
  --env "CREATE_GH_RELEASE=$CREATE_GH_RELEASE"
  --env "DRY_RUN=$DRY_RUN"
  --env "SKIP_SMOKE_TESTS=$SKIP_SMOKE_TESTS"
)

if [[ -t 1 ]]; then
  DOCKER_ARGS+=(-t)
fi

docker run "${DOCKER_ARGS[@]}" "$IMAGE"
