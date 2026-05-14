#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

if [[ " $* " == *" --help "* ]]; then
  cd sdk
  ./scripts/release.sh --help
  exit 0
fi

# Extract auth from existing tooling so we can keep `pnpm release` opaque.
# npm token: from ~/.npmrc (or NPM_TOKEN override)
# GitHub token: from gh CLI auth (or GH_TOKEN override)
# Branch: from the current git checkout

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
NPM_TOKEN_SOURCE="NPM_TOKEN env"

if [[ -z "${NPM_TOKEN:-}" ]]; then
  USER_NPMRC="$(npm config get userconfig 2>/dev/null || true)"
  NPM_TOKEN_SOURCE="${USER_NPMRC:-~/.npmrc}"
  if [[ -n "$USER_NPMRC" && -f "$USER_NPMRC" ]]; then
    NPM_TOKEN="$(grep -E '^[[:space:]]*//registry\.npmjs\.org/:_authToken=' "$USER_NPMRC" | tail -n1 | sed 's/.*=//')"
  else
    NPM_TOKEN=""
  fi
fi

validate_npm_publish_access() {
  local temp_dir temp_npmrc npm_username npm_owners package_name

  if [[ -z "$NPM_TOKEN" ]]; then
    echo "[Release] Error: no npm token was found in $NPM_TOKEN_SOURCE."
    echo "Set NPM_TOKEN or sign in to npm with a publish-capable token."
    exit 1
  fi

  package_name="$(cd sdk && npm pkg get name | tr -d '"')"
  temp_dir="$(mktemp -d)"
  temp_npmrc="$temp_dir/.npmrc"

  cat >"$temp_npmrc" <<EOF
registry=https://registry.npmjs.org/
//registry.npmjs.org/:_authToken=$NPM_TOKEN
EOF

  if ! npm_username="$(NPM_CONFIG_USERCONFIG="$temp_npmrc" npm whoami --registry=https://registry.npmjs.org/ 2>/dev/null)"; then
    rm -rf "$temp_dir"
    echo "[Release] Error: the npm token from $NPM_TOKEN_SOURCE cannot authenticate to registry.npmjs.org."
    echo "Run npm login or set NPM_TOKEN to a publish-capable token."
    exit 1
  fi

  npm_owners="$(npm owner ls "$package_name" --registry=https://registry.npmjs.org/ 2>/dev/null || true)"
  if ! grep -qE "^${npm_username}[[:space:]]" <<<"$npm_owners"; then
    rm -rf "$temp_dir"
    echo "[Release] Error: npm token authenticates as '$npm_username', but '$package_name' is owned by:"
    echo "$npm_owners"
    exit 1
  fi

  rm -rf "$temp_dir"
}

if [[ "$DRY_RUN" != true ]]; then
  validate_npm_publish_access
fi

if [[ -z "${GH_TOKEN:-}" ]]; then
  if command -v gh >/dev/null 2>&1; then
    GH_TOKEN="$(gh auth token 2>/dev/null || true)"
  fi
fi
if [[ "$GH_TOKEN" == "null" ]]; then
  GH_TOKEN=""
fi

AI_AGENT=1 \
  NPM_TOKEN="$NPM_TOKEN" \
  GH_TOKEN_FOR_RELEASES="$GH_TOKEN" \
  RWSDK_RELEASE_BRANCH="$CURRENT_BRANCH" \
  RWSDK_RELEASE_SHA="$CURRENT_SHA" \
  VERSION_TYPE="$VERSION_TYPE" \
  VERSION="$VERSION" \
  CREATE_GH_RELEASE="$CREATE_GH_RELEASE" \
  DRY_RUN="$DRY_RUN" \
  SKIP_SMOKE_TESTS="$SKIP_SMOKE_TESTS" \
  npx @redwoodjs/agent-ci run --workflow .agent-ci/workflows/release.yml
