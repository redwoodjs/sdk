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
NPM_OTP="${NPM_OTP:-}"

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

LOG_FILE="$(mktemp)"
cleanup() {
  rm -f "$LOG_FILE"
}
trap cleanup EXIT

(
  set -o pipefail
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
    NPM_OTP="" \
    npx @redwoodjs/agent-ci "${AGENT_CI_ARGS[@]}" 2>&1 | tee "$LOG_FILE"
) &
AGENT_CI_PID=$!

RUNNER_NAME=""
LOG_DIR=""
SIGNALS_DIR=""
REQUEST_HANDLED="false"

while kill -0 "$AGENT_CI_PID" 2>/dev/null; do
  if [[ -z "$RUNNER_NAME" ]]; then
    RUNNER_NAME="$(grep -m1 '^\[Agent CI\] Starting runner ' "$LOG_FILE" | sed -E 's/^\[Agent CI\] Starting runner ([^ ]+) .*/\1/' || true)"
  fi

  if [[ -z "$LOG_DIR" ]]; then
    LOG_DIR="$(grep -m1 '^  Logs: ' "$LOG_FILE" | sed 's/^  Logs: //' || true)"
    if [[ -n "$LOG_DIR" ]]; then
      SIGNALS_DIR="$LOG_DIR/signals"
    fi
  fi

  if [[ -n "$SIGNALS_DIR" && -f "$SIGNALS_DIR/publish-otp-request" ]]; then
    if [[ "$REQUEST_HANDLED" == "false" ]]; then
      REQUEST_HANDLED="true"
      echo "[Release] npm OTP requested by agent-ci."
      if [[ -s "$SIGNALS_DIR/publish-otp-request" ]]; then
        sed 's/^/  /' "$SIGNALS_DIR/publish-otp-request" || true
      fi

      if [[ -n "$NPM_OTP" ]]; then
        OTP_VALUE="$NPM_OTP"
        NPM_OTP=""
      elif [[ -t 0 ]]; then
        read -r -s -p "npm OTP: " OTP_VALUE
        echo
      else
        echo "[Release] Error: OTP requested but stdin is not interactive and NPM_OTP is unset."
        if [[ -n "$RUNNER_NAME" ]]; then
          npx @redwoodjs/agent-ci abort --name "$RUNNER_NAME" >/dev/null 2>&1 || true
        fi
        kill "$AGENT_CI_PID" >/dev/null 2>&1 || true
        wait "$AGENT_CI_PID" || true
        exit 1
      fi

      printf '%s' "$OTP_VALUE" > "$SIGNALS_DIR/publish-otp"
    fi
  else
    REQUEST_HANDLED="false"
  fi

  if [[ -n "$SIGNALS_DIR" && -f "$SIGNALS_DIR/paused" && ! -f "$SIGNALS_DIR/publish-otp-request" ]]; then
    echo "[Release] agent-ci paused on a non-OTP failure."
    if [[ -n "$RUNNER_NAME" ]]; then
      npx @redwoodjs/agent-ci abort --name "$RUNNER_NAME" >/dev/null 2>&1 || true
    fi
    kill "$AGENT_CI_PID" >/dev/null 2>&1 || true
    wait "$AGENT_CI_PID" || true
    exit 1
  fi

  sleep 1
done

wait "$AGENT_CI_PID"
