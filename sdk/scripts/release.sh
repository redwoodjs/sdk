#!/bin/bash

set -e  # Stop on first error

SUCCESS_FLAG=false # Default to failure. This will be checked by the cleanup trap.

DEPENDENCY_NAME="rwsdk"  # Replace with the actual package name

show_help() {
  echo "Usage: pnpm release <patch|minor|beta|test|canary|explicit> [--version <string>] [--dry]"
  echo
  echo "Automates version bumping, publishing, and dependency updates for $DEPENDENCY_NAME."
  echo "For safety, only 'patch', 'minor', 'beta', 'test', and 'canary' bumps can be calculated automatically."
  echo "To release a major or pre-release version, you MUST use the 'explicit' version_type and provide the exact version string with '--version'."
  echo
  echo "Arguments:"
  echo "  patch|minor|beta|test|canary  Calculates the next version of this type automatically."
  echo "  explicit                      Requires the '--version' flag to specify the exact version to release."
  echo ""
  echo "Process:"
  echo "  1.  Calculates new version (for patch/minor/beta/test/canary) or uses the manual version (for explicit), and updates package.json."
  echo "  2.  Commits the version change."
  echo "  3.  Builds the package with NODE_ENV=production."
  echo "  4.  Bundles the package into a .tgz tarball using \`npm pack\`."
  echo "  5.  Performs a comprehensive smoke test on the packed tarball:"
  echo "      - Verifies the packed \`dist\` contents match the local build via checksum."
  echo "      - Runs \`npx rw-scripts smoke-tests\` in a temporary project."
  echo "  6.  If smoke tests pass, publishes the .tgz tarball to npm (beta versions use --tag latest, other prereleases use --tag pre, test builds use --tag test, canary builds use --tag canary)."
  echo "  7.  On successful publish (for non-prereleases):"
  echo "      - Updates dependencies in the monorepo."
  echo "      - Amends the initial commit with dependency updates."
  echo "      - Tags the commit and pushes to the remote repository."
  echo "  8.  On failure (publish or smoke test):"
  echo "      - The version commit is reverted."
  echo "      - Temporary files are cleaned up."
  echo ""
  echo "Options:"
  echo "  --dry               Simulate the release process without making changes"
  echo "  --version <v>       Manually specify a version string. MUST be used with the 'explicit' version_type."
  echo "  --skip-smoke-tests  Bypass the smoke testing step. Use with caution."
  echo "  --help              Show this help message"
  echo ""
  echo "Examples:"
  echo "  pnpm release patch                    # 0.1.0 -> 0.1.1"
  echo "  pnpm release minor                    # 0.1.1 -> 0.2.0"
  echo "  pnpm release beta                     # 1.0.0-beta.27 -> 1.0.0-beta.28"
  echo "  pnpm release test                     # 1.0.0 -> 1.0.0-test.0 (published as @test)"
  echo "  pnpm release canary                   # 1.0.0 -> 1.0.0-canary.0 (published as @canary)"
  echo "  pnpm release explicit --version 1.0.0 # Release a major version"
  echo "  pnpm release explicit --version 1.0.0-rc.0 # Release a pre-release"
  exit 0
}

validate_args() {
  for arg in "$@"; do
    if [[ "$arg" == --* && "$arg" != "--dry" && "$arg" != "--help" && "$arg" != "--version" && "$arg" != "--skip-smoke-tests" ]]; then
      echo "Error: Unknown flag '$arg'"
      echo "Use --help to see available options"
      echo ""
      show_help  # This will show the help message and exit
    fi
  done
}

# Reorder argument handling
validate_args "$@"

# Initialize variables
DRY_RUN=false
VERSION_TYPE=""
MANUAL_VERSION=""
SKIP_SMOKE_TESTS=false

# Process all arguments
i=1
while [[ $i -le $# ]]; do
  arg="${!i}"
  case "$arg" in
    --help)
      show_help
      ;;
    --dry)
      DRY_RUN=true
      ;;
    --skip-smoke-tests)
      SKIP_SMOKE_TESTS=true
      ;;
    --version)
      i=$((i + 1))
      MANUAL_VERSION="${!i}"
      if [[ -z "$MANUAL_VERSION" ]]; then
        echo "Error: --version requires a value"
        echo ""
        show_help
      fi
      ;;
    patch|minor|beta|test|canary|explicit)
      VERSION_TYPE=$arg
      ;;
  esac
  i=$((i + 1))
done

# Sanitize version input
if [[ -n "$MANUAL_VERSION" && "$MANUAL_VERSION" == v* ]]; then
  echo "Sanitizing version input: stripping leading 'v' from '$MANUAL_VERSION'"
  MANUAL_VERSION="${MANUAL_VERSION#v}"
  echo "Sanitized version: '$MANUAL_VERSION'"
fi

# Validate required arguments
if [[ -z "$VERSION_TYPE" ]]; then
  echo "Error: Version type (patch|minor|beta|test|canary|explicit) is required."
  echo ""
  show_help
fi

# Validate illegal argument combinations
if [[ "$VERSION_TYPE" == "explicit" && -z "$MANUAL_VERSION" ]]; then
  echo "Error: The 'explicit' version_type requires the --version flag to be set."
  exit 1
fi

if [[ "$VERSION_TYPE" != "explicit" && -n "$MANUAL_VERSION" ]]; then
  echo "Error: The --version flag can only be used with the 'explicit' version_type."
  exit 1
fi

if [[ "$VERSION_TYPE" == "test" && -n "$MANUAL_VERSION" ]]; then
  echo "Error: Manual version cannot be specified for 'test' releases."
  exit 1
fi

if [[ "$VERSION_TYPE" == "canary" && -n "$MANUAL_VERSION" ]]; then
  echo "Error: Manual version cannot be specified for 'canary' releases."
  exit 1
fi

# After argument validation and before version calculation
echo -e "\n🔄 Pulling for changes..."
if [[ "$DRY_RUN" == true ]]; then
  echo "  [DRY RUN] git pull --rebase"
else
  if [[ -n "$AGENT_CI_LOCAL" ]]; then
    echo "  [AGENT CI] Resetting tracked workspace changes and skipping pull"
    git reset --hard HEAD
  else
    git pull --rebase
  fi
fi

echo -e "\n📦 Making sure dependencies are up to date..."
if [[ "$DRY_RUN" == true ]]; then
  echo "  [DRY RUN] pnpm install --frozen-lockfile"
else
  pnpm install --frozen-lockfile --ignore-scripts
fi

echo -e "\n🏗️  Building package..."
if [[ "$DRY_RUN" == true ]]; then
  echo "  [DRY RUN] NOTE: Forcing build to allow for artifact verification."
fi
NODE_ENV=production pnpm build

CURRENT_VERSION=$(npm pkg get version | tr -d '"')
RELEASE_BRANCH="${RWSDK_RELEASE_BRANCH:-$(git branch --show-current 2>/dev/null || true)}"
if [[ -z "$RELEASE_BRANCH" ]]; then
  RELEASE_BRANCH="HEAD"
fi

echo "  Release branch: $RELEASE_BRANCH"

# context(justinvdm, 2026-05-06): Canary releases roll back the version commit after publish, so package.json is not a reliable source for the next canary number.
get_latest_canary_version() {
  local candidates=()
  local local_tags gh_tags remote_tags repo_url repo_slug

  mapfile -t local_tags < <(git tag --list 'v*canary.*' | sed 's#^v##')
  for tag in "${local_tags[@]}"; do
    if [[ -n "$tag" ]]; then
      candidates+=("$tag")
    fi
  done

  if command -v gh >/dev/null 2>&1; then
    repo_url=$(git remote get-url origin 2>/dev/null || true)
    case "$repo_url" in
      https://github.com/*)
        repo_slug="${repo_url#https://github.com/}"
        repo_slug="${repo_slug%.git}"
        ;;
      git@github.com:*)
        repo_slug="${repo_url#git@github.com:}"
        repo_slug="${repo_slug%.git}"
        ;;
      *)
        repo_slug="${GITHUB_REPOSITORY:-redwoodjs/sdk}"
        ;;
    esac

    if [[ -n "$repo_slug" ]]; then
      mapfile -t gh_tags < <(gh api "repos/$repo_slug/git/matching-refs/tags/v" --paginate --jq '.[].ref' | grep -- '-canary\.' | sed 's#refs/tags/v##')
      for tag in "${gh_tags[@]}"; do
        if [[ -n "$tag" ]]; then
          candidates+=("$tag")
        fi
      done
    fi
  fi

  mapfile -t remote_tags < <(git ls-remote --tags origin 'refs/tags/v*canary.*' | awk '{print $2}' | grep -v '\^{}' | sed 's#refs/tags/v##')
  for tag in "${remote_tags[@]}"; do
    if [[ -n "$tag" ]]; then
      candidates+=("$tag")
    fi
  done

  if [[ ${#candidates[@]} -gt 0 ]]; then
    printf '%s\n' "${candidates[@]}" | sort -V | tail -n 1
  fi
}

increment_canary_version() {
  local version="$1"

  if [[ "$version" =~ ^(.*)-canary\.([0-9]+)$ ]]; then
    local base_version="${BASH_REMATCH[1]}"
    local canary_number="${BASH_REMATCH[2]}"
    echo "$base_version-canary.$((canary_number + 1))"
  fi
}

PUBLISH_OTP_SIGNAL_DIR=""
PUBLISH_OTP_REQUEST_FILE=""
PUBLISH_OTP_RESPONSE_FILE=""

build_publish_args() {
  PUBLISH_ARGS=(npm publish "$TARBALL_PATH")

  if [[ "$VERSION_TYPE" == "test" ]]; then
    PUBLISH_ARGS+=(--tag test)
  elif [[ "$VERSION_TYPE" == "canary" || "$IS_CANARY_VERSION" == true ]]; then
    PUBLISH_ARGS+=(--tag canary)
  elif [[ "$NEW_VERSION" == *"-beta."* ]]; then
    PUBLISH_ARGS+=(--tag latest)
  elif [[ "$NEW_VERSION" == *"-*" ]]; then
    # Other pre-releases should use the 'pre' dist-tag
    PUBLISH_ARGS+=(--tag pre)
  fi
}

publish_requires_otp() {
  local output="$1"
  grep -qiE 'EOTP|one-time password' <<<"$output"
}

request_publish_otp() {
  PUBLISH_OTP_SIGNAL_DIR="${__SIGNALS:-}"
  if [[ -z "$PUBLISH_OTP_SIGNAL_DIR" || ! -d "$PUBLISH_OTP_SIGNAL_DIR" ]]; then
    echo "  ❌ Publish requires an OTP, but the agent-ci signals directory is not mounted."
    return 1
  fi

  PUBLISH_OTP_REQUEST_FILE="$PUBLISH_OTP_SIGNAL_DIR/publish-otp-request"
  PUBLISH_OTP_RESPONSE_FILE="$PUBLISH_OTP_SIGNAL_DIR/publish-otp"
  rm -f "$PUBLISH_OTP_REQUEST_FILE" "$PUBLISH_OTP_RESPONSE_FILE"

  cat >"$PUBLISH_OTP_REQUEST_FILE" <<EOF
package=$DEPENDENCY_NAME
version=$NEW_VERSION
tag=$TAG_NAME
tarball=$TARBALL_PATH
EOF

  echo "  ⏳ Waiting for npm OTP from the host..."
  while [[ ! -s "$PUBLISH_OTP_RESPONSE_FILE" ]]; do
    sleep 1
  done

  NPM_OTP="$(tr -d '\r\n' < "$PUBLISH_OTP_RESPONSE_FILE")"
  rm -f "$PUBLISH_OTP_RESPONSE_FILE" "$PUBLISH_OTP_REQUEST_FILE"

  if [[ -z "$NPM_OTP" ]]; then
    echo "  ❌ Received an empty npm OTP."
    return 1
  fi
}

# Validate that patch/minor/major cannot be used when currently in a pre-release (excluding test and canary)
if [[ "$VERSION_TYPE" == "patch" || "$VERSION_TYPE" == "minor" || "$VERSION_TYPE" == "major" ]]; then
  if [[ "$CURRENT_VERSION" == *"-"* && "$CURRENT_VERSION" != *"-test."* && "$CURRENT_VERSION" != *"-canary."* ]]; then
    echo "Error: Cannot use '$VERSION_TYPE' version type when current version is a pre-release ($CURRENT_VERSION)."
    echo "To release a major version after a pre-release, use 'explicit' version type and specify the exact version."
    exit 1
  fi
fi

if [[ "$VERSION_TYPE" == "explicit" ]]; then
  NEW_VERSION="$MANUAL_VERSION"
elif [[ "$VERSION_TYPE" == "test" ]]; then
  # Use a timestamp for test versions instead of a counter to avoid conflicts between branches
  # Format: YYYYMMDDHHMMSS
  TIMESTAMP=$(date "+%Y%m%d%H%M%S")
  # Extract base version (strip any existing test suffix)
  if [[ "$CURRENT_VERSION" =~ ^(.*)-test\..*$ ]]; then
    BASE_VERSION="${BASH_REMATCH[1]}"
  else
    BASE_VERSION="$CURRENT_VERSION"
  fi
  NEW_VERSION="$BASE_VERSION-test.$TIMESTAMP"
elif [[ "$VERSION_TYPE" == "canary" ]]; then
  if [[ "$RELEASE_BRANCH" == "main" ]]; then
    if [[ "$CURRENT_VERSION" =~ ^(.*)-canary\.([0-9]+)$ ]]; then
      BASE_VERSION="${BASH_REMATCH[1]}"
    else
      BASE_VERSION="$CURRENT_VERSION"
    fi
    NEW_VERSION="$BASE_VERSION-canary.0"
  else
    CURRENT_CANARY_VERSION=""
    if [[ "$CURRENT_VERSION" =~ ^(.*)-canary\.([0-9]+)$ ]]; then
      CURRENT_CANARY_VERSION="$CURRENT_VERSION"
    fi

    LATEST_CANARY_VERSION="$(get_latest_canary_version)"
    CANDIDATE_CANARY_VERSIONS=()

    if [[ -n "$CURRENT_CANARY_VERSION" ]]; then
      CANDIDATE_CANARY_VERSIONS+=("$CURRENT_CANARY_VERSION")
    fi

    if [[ -n "$LATEST_CANARY_VERSION" ]]; then
      CANDIDATE_CANARY_VERSIONS+=("$LATEST_CANARY_VERSION")
    fi

    if [[ ${#CANDIDATE_CANARY_VERSIONS[@]} -gt 0 ]]; then
      NEWEST_CANARY_VERSION=$(printf '%s\n' "${CANDIDATE_CANARY_VERSIONS[@]}" | sort -V | tail -n 1)
      NEW_VERSION="$(increment_canary_version "$NEWEST_CANARY_VERSION")"
    else
      NEW_VERSION="$CURRENT_VERSION-canary.0"
    fi
  fi
elif [[ "$VERSION_TYPE" == "beta" ]]; then
  # Handle beta version bumping: 1.0.0-beta.27 -> 1.0.0-beta.28
  if [[ "$CURRENT_VERSION" =~ ^(.*)-beta\.([0-9]+)$ ]]; then
    BASE_VERSION="${BASH_REMATCH[1]}"
    BETA_NUMBER="${BASH_REMATCH[2]}"
    NEW_BETA_NUMBER=$((BETA_NUMBER + 1))
    NEW_VERSION="$BASE_VERSION-beta.$NEW_BETA_NUMBER"
  else
    echo "Error: Current version '$CURRENT_VERSION' is not a beta version. Beta bump requires a version in the format X.Y.Z-beta.N"
    exit 1
  fi
else
  # Handle regular versions (patch, minor, major)
  NEW_VERSION=$(npx semver -i "$VERSION_TYPE" "$CURRENT_VERSION")
fi

# Detect canary versions regardless of how they were specified (e.g. explicit --version 1.3.0-canary.0)
IS_CANARY_VERSION=false
if [[ "$NEW_VERSION" == *"-canary."* ]]; then
  IS_CANARY_VERSION=true
fi

echo -e "\n📦 Planning version bump to $NEW_VERSION ($VERSION_TYPE)..."
if [[ "$IS_CANARY_VERSION" == true ]]; then
  echo "  (Detected as canary release)"
fi
if [[ "$DRY_RUN" == true ]]; then
  echo "  [DRY RUN] sed -i.bak \"s/\\\"version\\\": \\\"[^\\\"]*\\\"/\\\"version\\\": \\\"$NEW_VERSION\\\"/\" package.json && rm package.json.bak"
  echo "  [DRY RUN] Git commit version change"
else
  sed -i.bak "s/\"version\": \"[^\"]*\"/\"version\": \"$NEW_VERSION\"/" package.json && rm package.json.bak
  git add package.json
  git commit -m "chore(release): $NEW_VERSION"
fi

TAG_NAME="v$NEW_VERSION"
if [[ -n "$GITHUB_ENV" ]]; then
  echo "TAG_NAME=$TAG_NAME" >> "$GITHUB_ENV"
fi

echo -e "\n📦 Packing package..."
if [[ "$DRY_RUN" == true ]]; then
  echo "  [DRY RUN] NOTE: Actually packing package to allow for smoke testing."
fi

# The `TEMP_DIR` is created here so we can pack the tarball into it
# and keep the git working directory clean.
TEMP_DIR=$(mktemp -d)

# Always pack the package to allow for smoke testing, even in a dry run.
TARBALL_NAME=$(npm pack --pack-destination "$TEMP_DIR" | tail -n 1)
TARBALL_PATH="$TEMP_DIR/$TARBALL_NAME"
if [ ! -f "$TARBALL_PATH" ]; then
  echo "❌ npm pack failed to create tarball"
  exit 1
fi
echo "  ✅ Packed to $TARBALL_PATH"

echo -e "\n🔬 Smoke testing package..."
if [[ "$SKIP_SMOKE_TESTS" == true ]]; then
  echo "  ⏭️  Skipping smoke tests as requested."
else
  # The smoke test runs in both normal and dry-run modes.

  # This cleanup function will be called on EXIT.
  # It checks if the script is finishing successfully or not.
  cleanup() {
    # If the script did not complete successfully, preserve assets for inspection.
    if [[ "$SUCCESS_FLAG" == false ]]; then
      echo -e "\n❌ A failure occurred. Preserving temp directory for inspection:"
      echo "  - Temp directory: $TEMP_DIR"
    else
      # Otherwise (on success), clean up the temp dir.
      if [[ -n "$TEMP_DIR" && -d "$TEMP_DIR" ]]; then
        echo "  - Cleaning up temp directory..."
        rm -rf "$TEMP_DIR"
      fi
    fi
    # The tarball is stored in TEMP_DIR and cleaned up with it.
  }

  # Set the trap *after* creating the temp dir, so the variable is available.
  trap cleanup EXIT

  echo "  - Running smoke tests..."
  # The CWD is the package root (sdk/sdk), so we can run pnpm smoke-test directly.
  # We also specify an artifact directory *within* the temp directory.
  # todo(justinvdm, 11 Aug 2025): Fix style test flakiness
  # Pass the tarball path to the smoke test environment
  export RWSKD_SMOKE_TEST_TARBALL_PATH="$TARBALL_PATH"
  SMOKE_TEST_ARGS=(--artifact-dir="$TEMP_DIR/artifacts" --skip-style-tests)
  if [[ "${CI:-}" == "true" || "${CI:-}" == "1" || -n "${GITHUB_ACTIONS:-}" ]]; then
    SMOKE_TEST_ARGS+=(--ci)
    export GITHUB_EVENT_NAME="pull_request"
  fi
  if ! pnpm smoke-test "${SMOKE_TEST_ARGS[@]}"; then
    echo "  ❌ Smoke tests failed."
    exit 1
  fi
  echo "  ✅ Smoke tests passed."
fi

if [[ "$DRY_RUN" == true ]]; then
  if [[ "$VERSION_TYPE" == "test" ]]; then
    echo "  [DRY RUN] npm publish '$TARBALL_PATH' --tag test"
  elif [[ "$VERSION_TYPE" == "canary" || "$IS_CANARY_VERSION" == true ]]; then
    echo "  [DRY RUN] npm publish '$TARBALL_PATH' --tag canary"
  elif [[ "$NEW_VERSION" == *"-beta."* ]]; then
    echo "  [DRY RUN] npm publish '$TARBALL_PATH' --tag latest"
  elif [[ "$NEW_VERSION" == *"-*" ]]; then
    echo "  [DRY RUN] npm publish '$TARBALL_PATH' --tag pre"
  else
    echo "  [DRY RUN] npm publish '$TARBALL_PATH'"
  fi
else
  build_publish_args

  while true; do
    set +e
    if [[ -n "${NPM_OTP:-}" ]]; then
      PUBLISH_OUTPUT="$(NPM_CONFIG_OTP="$NPM_OTP" "${PUBLISH_ARGS[@]}" 2>&1)"
    else
      PUBLISH_OUTPUT="$("${PUBLISH_ARGS[@]}" 2>&1)"
    fi
    PUBLISH_STATUS=$?
    set -e

    echo "$PUBLISH_OUTPUT"
    if [[ $PUBLISH_STATUS -eq 0 ]]; then
      echo "  ✅ Published successfully."
      break
    fi

    if publish_requires_otp "$PUBLISH_OUTPUT"; then
      if ! request_publish_otp; then
        echo -e "\n❌ Publish failed. Rolling back version commit..."
        git reset --hard HEAD~1
        # The trap will clean up the tarball
        exit 1
      fi
      continue
    fi

    echo -e "\n❌ Publish failed. Rolling back version commit..."
    git reset --hard HEAD~1
    # The trap will clean up the tarball
    exit 1
  done
fi

echo -e "\n💾 Pushing commit and tag..."
if [[ "$DRY_RUN" == true ]]; then
  echo "  [DRY RUN] Git operations:"
  if [[ "$VERSION_TYPE" == "test" || "$VERSION_TYPE" == "canary" || "$IS_CANARY_VERSION" == true ]]; then
    echo "    - Tag: $TAG_NAME"
    echo "    - Push tag $TAG_NAME to remote"
    echo "    - Reset branch to previous commit (commit will be on remote via tag)"
    echo "    - No branch push will be performed"
  else
    echo "    - Tag: $TAG_NAME"
    echo "    - Push: origin with tags"
  fi
else
  if [[ "$VERSION_TYPE" == "test" || "$VERSION_TYPE" == "canary" || "$IS_CANARY_VERSION" == true ]]; then
    echo "  - Creating tag for canary release..."
    git tag "$TAG_NAME"
    echo "  - Pushing tag to remote..."
    git push origin "$TAG_NAME"
    echo "  - Rolling back local commit for canary release. The commit is available via the remote tag."
    git reset --hard HEAD~1
  else
    # As a final safety measure, check for and discard any remaining unstaged changes
    # This prevents the rebase/push from failing due to an unexpectedly dirty working directory
    if ! git diff-index --quiet HEAD --; then
      echo "::warning::Detected unstaged changes before final push. This should not happen."
      echo "Stashing changes to ensure a clean push:"
      git stash --include-untracked
      git stash drop
    fi
    git tag "$TAG_NAME"
    git push origin main
    git push origin "$TAG_NAME"
  fi
fi

# If we've reached the end of the script, it was successful.
SUCCESS_FLAG=true

if [[ "$DRY_RUN" == true ]]; then
  echo -e "\n✨ Done! Released version $NEW_VERSION (DRY RUN)\n"
else
  echo -e "\n✨ Done! Released version $NEW_VERSION\n"
fi
