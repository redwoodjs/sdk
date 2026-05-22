#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

DEPENDENCY_NAME="rwsdk"

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
CURRENT_REMOTE_URL="$(git remote get-url origin 2>/dev/null || true)"

NPM_TOKEN_SOURCE="NPM_TOKEN environment variable"
if [[ -z "${NPM_TOKEN:-}" ]]; then
  USER_NPMRC="$(npm config get userconfig 2>/dev/null || true)"
  if [[ -n "$USER_NPMRC" && -f "$USER_NPMRC" ]]; then
    NPM_TOKEN="$(grep -E '^[[:space:]]*//registry\.npmjs\.org/:_authToken=' "$USER_NPMRC" | tail -n1 | sed 's/.*=//')"
    NPM_TOKEN_SOURCE="$USER_NPMRC"
  else
    NPM_TOKEN=""
    NPM_TOKEN_SOURCE="not found"
  fi
fi

GH_TOKEN_SOURCE="GH_TOKEN environment variable"
if [[ -z "${GH_TOKEN:-}" && -n "${GH_TOKEN_FOR_RELEASES:-}" ]]; then
  GH_TOKEN="$GH_TOKEN_FOR_RELEASES"
  GH_TOKEN_SOURCE="GH_TOKEN_FOR_RELEASES environment variable"
elif [[ -z "${GH_TOKEN:-}" ]]; then
  if command -v gh >/dev/null 2>&1; then
    GH_TOKEN="$(gh auth token 2>/dev/null || true)"
    GH_TOKEN_SOURCE="gh auth token"
  else
    GH_TOKEN=""
    GH_TOKEN_SOURCE="not found"
  fi
fi
if [[ "$GH_TOKEN" == "null" ]]; then
  GH_TOKEN=""
  GH_TOKEN_SOURCE="not found"
fi

repo_slug_from_remote() {
  local remote_url="$1"
  local repo_slug=""

  case "$remote_url" in
    https://github.com/*)
      repo_slug="${remote_url#https://github.com/}"
      repo_slug="${repo_slug%.git}"
      ;;
    git@github.com:*)
      repo_slug="${remote_url#git@github.com:}"
      repo_slug="${repo_slug%.git}"
      ;;
  esac

  if [[ -z "$repo_slug" ]]; then
    repo_slug="${GITHUB_REPOSITORY:-redwoodjs/sdk}"
  fi

  printf '%s' "$repo_slug"
}

sanitize_output() {
  sed -E \
    -e 's#(//registry\.npmjs\.org/:_authToken=)[^[:space:]"'"'"']+#\1***#g' \
    -e 's#\b(npm_)[A-Za-z0-9_=-]+\b#\1***#g' \
    -e 's#\b(github_pat_)[A-Za-z0-9_]+\b#\1***#g' \
    -e 's#\b(gh[opsu]_)[A-Za-z0-9_]+\b#\1***#g' \
    -e 's#(authId=)[A-Za-z0-9-]+#\1***#g'
}

PREFLIGHT_ERRORS=0
PREFLIGHT_WARNINGS=0
preflight_ok() {
  echo "  ✓ $*"
}
preflight_warn() {
  echo "  ⚠ $*"
  PREFLIGHT_WARNINGS=$((PREFLIGHT_WARNINGS + 1))
}
preflight_error() {
  echo "  ✗ $*"
  PREFLIGHT_ERRORS=$((PREFLIGHT_ERRORS + 1))
}

run_release_preflight() {
  PREFLIGHT_ERRORS=0
  PREFLIGHT_WARNINGS=0

  echo "[release] Preflight checks"
  echo "[release] Requirements: Docker, Node/npm, an npm Automation/granular publish token for $DEPENDENCY_NAME, and a GitHub token that can push/create releases."

  if command -v docker >/dev/null 2>&1; then
    if docker info >/dev/null 2>&1; then
      preflight_ok "Docker daemon is running"
    else
      preflight_error "Docker is installed, but the daemon is not reachable. Start Docker/OrbStack and retry."
    fi
  else
    preflight_error "Docker CLI is not installed or not on PATH. agent-ci needs Docker to run the release container."
  fi

  if command -v node >/dev/null 2>&1; then
    preflight_ok "Node is available ($(node --version))"
  else
    preflight_error "Node is not installed or not on PATH."
  fi

  if command -v npm >/dev/null 2>&1; then
    preflight_ok "npm is available ($(npm --version 2>/dev/null))"
  else
    preflight_error "npm is not installed or not on PATH."
  fi

  if [[ "$VERSION_TYPE" == "explicit" && "$VERSION" == "none" ]]; then
    preflight_error "explicit releases require --version <version>."
  fi

  if [[ "$VERSION_TYPE" != "test" && "$VERSION_TYPE" != "canary" ]]; then
    case "$CURRENT_BRANCH" in
      main|next)
        preflight_ok "Release branch '$CURRENT_BRANCH' is allowed for $VERSION_TYPE releases"
        ;;
      *)
        preflight_error "$VERSION_TYPE releases must run from main or next. Current branch is '$CURRENT_BRANCH'."
        ;;
    esac
  else
    preflight_ok "$VERSION_TYPE releases are allowed from branch '$CURRENT_BRANCH'"
  fi

  if [[ -n "$(git status --porcelain)" ]]; then
    preflight_error "Working tree has uncommitted changes. Commit or stash them before running a real release."
  else
    preflight_ok "Working tree is clean"
  fi

  if [[ -n "$CURRENT_REMOTE_URL" ]]; then
    preflight_ok "Git remote origin is configured"
  else
    preflight_warn "Git remote origin is not configured; final push may fail."
  fi

  local repo_slug
  repo_slug="$(repo_slug_from_remote "$CURRENT_REMOTE_URL")"

  if [[ "$DRY_RUN" == true ]]; then
    preflight_ok "Dry run requested; npm/GitHub publish checks are informational"
  fi

  if [[ -z "$NPM_TOKEN" ]]; then
    if [[ "$DRY_RUN" == true ]]; then
      preflight_warn "No npm token found. Dry run can continue, but a real release needs NPM_TOKEN or ~/.npmrc auth."
    else
      preflight_error "No npm token found. Set NPM_TOKEN or add //registry.npmjs.org/:_authToken=... to your npm user config."
    fi
  else
    preflight_ok "npm token found from $NPM_TOKEN_SOURCE"

    local npmrc npm_user_output npm_user collabs_output permission profile_output tfa_mode
    npmrc="$(mktemp)"
    chmod 0600 "$npmrc"
    {
      printf 'registry=https://registry.npmjs.org/\n'
      printf '//registry.npmjs.org/:_authToken=%s\n' "$NPM_TOKEN"
    } > "$npmrc"

    if npm_user_output="$(NPM_CONFIG_USERCONFIG="$npmrc" npm whoami --registry=https://registry.npmjs.org/ 2>&1)"; then
      npm_user="$(printf '%s' "$npm_user_output" | tail -n1 | tr -d '\r')"
      preflight_ok "npm token authenticates as $npm_user"

      if collabs_output="$(NPM_CONFIG_USERCONFIG="$npmrc" npm access list collaborators "$DEPENDENCY_NAME" --json --registry=https://registry.npmjs.org/ 2>&1)"; then
        permission="$(COLLABS_JSON="$collabs_output" NPM_USER="$npm_user" node -e 'const data = JSON.parse(process.env.COLLABS_JSON || "{}"); const user = process.env.NPM_USER || ""; process.stdout.write(data[user] || "");' 2>/dev/null || true)"
        if [[ "$permission" == "read-write" ]]; then
          preflight_ok "npm user has read-write access to $DEPENDENCY_NAME"
        else
          preflight_warn "Could not confirm package access for npm user '$npm_user' from this token (reported access: ${permission:-none}). Granular publish tokens often cannot list collaborators; continuing and letting npm publish be the final check."
        fi
      else
        preflight_warn "Could not verify npm collaborator access for $DEPENDENCY_NAME: $(printf '%s' "$collabs_output" | sanitize_output | tail -n1)"
      fi

      if profile_output="$(NPM_CONFIG_USERCONFIG="$npmrc" npm profile get --json --registry=https://registry.npmjs.org/ 2>&1)"; then
        tfa_mode="$(PROFILE_JSON="$profile_output" node -e 'const data = JSON.parse(process.env.PROFILE_JSON || "{}"); process.stdout.write(data?.tfa?.mode || "unknown");' 2>/dev/null || true)"
        if [[ -n "$tfa_mode" && "$tfa_mode" != "unknown" ]]; then
          preflight_ok "npm account 2FA mode: $tfa_mode"
          if [[ "$tfa_mode" != "auth-only" && "$tfa_mode" != "disabled" ]]; then
            preflight_warn "npm account has 2FA on writes; use an Automation/granular publish token so the container can publish non-interactively."
          fi
        fi
      else
        preflight_warn "Could not inspect npm profile 2FA settings."
      fi
    else
      if [[ "$DRY_RUN" == true ]]; then
        preflight_warn "npm token did not pass whoami: $(printf '%s' "$npm_user_output" | sanitize_output | tail -n1)"
      else
        preflight_error "npm token did not pass whoami: $(printf '%s' "$npm_user_output" | sanitize_output | tail -n1)"
      fi
    fi

    rm -f "$npmrc"

    if [[ "$DRY_RUN" != true ]]; then
      preflight_warn "npm CLI cannot prove the token type before publish. If publish asks for browser auth or fails with E401/E404 from /-/v1/done, replace NPM_TOKEN with an npm Automation/granular token that has publish access to $DEPENDENCY_NAME."
    fi
  fi

  if [[ -z "$GH_TOKEN" ]]; then
    if [[ "$DRY_RUN" == true ]]; then
      preflight_warn "No GitHub token found. Dry run can continue, but a real release needs GH_TOKEN or gh auth."
    else
      preflight_error "No GitHub token found. Set GH_TOKEN/GH_TOKEN_FOR_RELEASES or run gh auth login."
    fi
  else
    preflight_ok "GitHub token found from $GH_TOKEN_SOURCE"
    if command -v gh >/dev/null 2>&1; then
      local gh_user gh_repo gh_push
      if gh_user="$(GH_TOKEN="$GH_TOKEN" gh api user --jq '.login' 2>&1)"; then
        preflight_ok "GitHub token authenticates as $gh_user"
      else
        preflight_error "GitHub token did not authenticate with gh api: $(printf '%s' "$gh_user" | sanitize_output | tail -n1)"
      fi

      if gh_repo="$(GH_TOKEN="$GH_TOKEN" gh api "repos/$repo_slug" --jq '.full_name' 2>&1)"; then
        preflight_ok "GitHub token can read $gh_repo"
        gh_push="$(GH_TOKEN="$GH_TOKEN" gh api "repos/$repo_slug" --jq '(.permissions.push // false) or (.permissions.admin // false)' 2>/dev/null || true)"
        if [[ "$gh_push" == "true" ]]; then
          preflight_ok "GitHub token reports push/admin access to $repo_slug"
        else
          preflight_warn "Could not confirm push/admin access for $repo_slug. The final git push may fail if the token is read-only."
        fi
      else
        preflight_error "GitHub token cannot read repo $repo_slug: $(printf '%s' "$gh_repo" | sanitize_output | tail -n1)"
      fi
    else
      preflight_warn "gh CLI is not installed locally, so GitHub token validity could not be checked."
    fi
  fi

  echo
  if [[ $PREFLIGHT_ERRORS -gt 0 ]]; then
    echo "[release] Preflight failed with $PREFLIGHT_ERRORS error(s) and $PREFLIGHT_WARNINGS warning(s)."
    echo "[release] Fix the items above, then rerun pnpm release."
    exit 1
  fi

  echo "[release] Preflight passed with $PREFLIGHT_WARNINGS warning(s)."
  echo
}

if [[ "${SKIP_RELEASE_PREFLIGHT:-false}" == "true" ]]; then
  echo "[release] Skipping preflight checks because SKIP_RELEASE_PREFLIGHT=true"
else
  run_release_preflight
fi

AGENT_CI_ARGS=(run --workflow .agent-ci/workflows/release.yml)
if [[ "$DRY_RUN" != true ]]; then
  AGENT_CI_ARGS=(run --pause-on-failure --workflow .agent-ci/workflows/release.yml)
fi

export AI_AGENT=1
export RWSDK_RELEASE_BRANCH="$CURRENT_BRANCH"
export RWSDK_RELEASE_SHA="$CURRENT_SHA"
export VERSION_TYPE="$VERSION_TYPE"
export VERSION="$VERSION"
export CREATE_GH_RELEASE="$CREATE_GH_RELEASE"
export DRY_RUN="$DRY_RUN"
export SKIP_SMOKE_TESTS="$SKIP_SMOKE_TESTS"

LOGS_ROOT="$HOME/Library/Application Support/agent-ci/logs"
RUN_STARTED_MS="$(node -e 'process.stdout.write(String(Date.now()))')"

find_release_runner_name() {
  node --input-type=module - "$LOGS_ROOT" "$RUN_STARTED_MS" <<'NODE'
import fs from 'node:fs';
import path from 'node:path';

const [logsRoot, startedMsRaw] = process.argv.slice(2);
const startedMs = Number(startedMsRaw || '0') - 30_000;
let best;

try {
  for (const entry of fs.readdirSync(logsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.startsWith('agent-ci-')) continue;
    const metadataPath = path.join(logsRoot, entry.name, 'metadata.json');
    let metadata;
    try {
      metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    } catch {
      continue;
    }
    if ((metadata.date || 0) < startedMs) continue;
    if (metadata.taskId !== 'release') continue;
    if (!String(metadata.workflowPath || '').endsWith('.agent-ci/workflows/release.yml')) continue;
    if (!best || metadata.date > best.date) best = { name: entry.name, date: metadata.date };
  }
} catch {
  // ignore
}

if (best) process.stdout.write(best.name);
NODE
}

sync_release_credentials() {
  local runner_name=""
  local deadline=$((SECONDS + 300))

  while (( SECONDS < deadline )); do
    if [[ -z "$runner_name" ]]; then
      runner_name="$(find_release_runner_name 2>/dev/null || true)"
    fi

    if [[ -n "$runner_name" ]] && docker inspect "$runner_name" >/dev/null 2>&1; then
      if [[ "$(docker inspect -f '{{.State.Running}}' "$runner_name" 2>/dev/null || true)" == "true" ]]; then
        printf '%s' "$NPM_TOKEN" | docker exec -i "$runner_name" sh -c 'umask 077; cat > /tmp/agent-ci-signals/release-npm-token' >/dev/null 2>&1 || true
        printf '%s' "$CURRENT_REMOTE_URL" | docker exec -i "$runner_name" sh -c 'umask 077; cat > /tmp/agent-ci-signals/release-remote-url' >/dev/null 2>&1 || true
        if [[ -n "$GH_TOKEN" ]]; then
          printf '%s' "$GH_TOKEN" | docker exec -i "$runner_name" sh -c 'umask 077; cat > /tmp/agent-ci-signals/release-gh-token' >/dev/null 2>&1 || true
        else
          docker exec "$runner_name" rm -f /tmp/agent-ci-signals/release-gh-token >/dev/null 2>&1 || true
        fi
        echo "[release] Prepared release credentials for $runner_name"
        return 0
      fi
    fi

    sleep 0.5
  done

  echo "[release] Warning: timed out waiting to prepare release credentials for the agent-ci runner."
}

cleanup() {
  if [[ -n "${WATCHER_PID:-}" ]]; then
    kill "$WATCHER_PID" 2>/dev/null || true
    wait "$WATCHER_PID" 2>/dev/null || true
    WATCHER_PID=""
  fi
  if [[ -n "${CREDENTIAL_SYNC_PID:-}" ]]; then
    kill "$CREDENTIAL_SYNC_PID" 2>/dev/null || true
    wait "$CREDENTIAL_SYNC_PID" 2>/dev/null || true
    CREDENTIAL_SYNC_PID=""
  fi
}
trap cleanup EXIT

echo "[release] Starting agent-ci release"
echo "[release] Version type: $VERSION_TYPE"
if [[ "$VERSION" != "none" ]]; then
  echo "[release] Version: $VERSION"
fi
echo "[release] Branch: $CURRENT_BRANCH (${CURRENT_SHA:0:12})"
echo "[release] npm token: $NPM_TOKEN_SOURCE"
if [[ -n "$GH_TOKEN" ]]; then
  echo "[release] GitHub token: $GH_TOKEN_SOURCE"
else
  echo "[release] GitHub token: not found"
fi
echo "[release] Logs: $LOGS_ROOT"
echo

node "$SCRIPT_DIR/watch-agent-ci-logs.mjs" "$LOGS_ROOT" "$RUN_STARTED_MS" &
WATCHER_PID=$!

sync_release_credentials &
CREDENTIAL_SYNC_PID=$!

set +e
env -u NPM_TOKEN -u GH_TOKEN -u GH_TOKEN_FOR_RELEASES npx --yes @redwoodjs/agent-ci "${AGENT_CI_ARGS[@]}"
EXIT_CODE=$?
set -e

if [[ $EXIT_CODE -ne 0 ]]; then
  echo
  echo "[release] agent-ci failed with exit code $EXIT_CODE"
  echo "[release] Logs are in: $LOGS_ROOT"
fi

exit "$EXIT_CODE"
