#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

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
    --dry)
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

if [[ -z "${NPM_TOKEN:-}" ]]; then
  USER_NPMRC="$(npm config get userconfig 2>/dev/null || true)"
  if [[ -n "$USER_NPMRC" && -f "$USER_NPMRC" ]]; then
    NPM_TOKEN="$(grep -E '^[[:space:]]*//registry\.npmjs\.org/:_authToken=' "$USER_NPMRC" | tail -n1 | sed 's/.*=//')"
  else
    NPM_TOKEN=""
  fi
fi

if [[ -z "${GH_TOKEN:-}" ]]; then
  if command -v gh >/dev/null 2>&1; then
    GH_TOKEN="$(gh auth token 2>/dev/null || true)"
  fi
fi
if [[ "$GH_TOKEN" == "null" ]]; then
  GH_TOKEN=""
fi

AGENT_CI_ARGS=(run --workflow .agent-ci/workflows/release.yml)
if [[ "$DRY_RUN" != true ]]; then
  AGENT_CI_ARGS=(run --pause-on-failure --workflow .agent-ci/workflows/release.yml)
fi

export AI_AGENT=1
export NPM_TOKEN="$NPM_TOKEN"
export GH_TOKEN_FOR_RELEASES="$GH_TOKEN"
export RWSDK_RELEASE_BRANCH="$CURRENT_BRANCH"
export RWSDK_RELEASE_SHA="$CURRENT_SHA"
export VERSION_TYPE="$VERSION_TYPE"
export VERSION="$VERSION"
export CREATE_GH_RELEASE="$CREATE_GH_RELEASE"
export DRY_RUN="$DRY_RUN"
export SKIP_SMOKE_TESTS="$SKIP_SMOKE_TESTS"

LOGS_ROOT="$HOME/Library/Application Support/agent-ci/logs"
cleanup() {
  if [[ -n "${WATCHER_PID:-}" ]]; then
    kill "$WATCHER_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

node "$SCRIPT_DIR/watch-agent-ci-logs.mjs" "$LOGS_ROOT" &
WATCHER_PID=$!

npx --yes @redwoodjs/agent-ci "${AGENT_CI_ARGS[@]}"
EXIT_CODE=$?
cleanup
exit "$EXIT_CODE"
