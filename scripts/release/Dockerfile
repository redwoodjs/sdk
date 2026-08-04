# Release container for rwsdk.
#
# Releases must run on a maintainer's machine, not in GitHub Actions: hosted
# runners expose OIDC tokens and npm credentials, and a poisoned cache or
# compromised action could publish malicious packages. This image is the
# whole release environment — ubuntu 24.04 (matching CI), Node, pnpm via
# corepack, gh, and the chromium system libraries — so the release path is
# reproducible and debuggable with plain `docker`.

FROM ubuntu:24.04

ARG NODE_VERSION=24.14.0
# context(justinvdm, 2026-08-04): gh is not in ubuntu's archive; pin a known
# release tarball.
ARG GH_VERSION=2.65.0

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    git \
    sudo \
    tar \
    xz-utils \
  && rm -rf /var/lib/apt/lists/*

# Node.js (official dist tarball; arch resolved from the build platform).
ARG TARGETARCH
RUN set -eux; \
  case "$TARGETARCH" in \
    amd64) NODE_ARCH="x64" ;; \
    arm64) NODE_ARCH="arm64" ;; \
    *) echo "unsupported arch: $TARGETARCH" >&2; exit 1 ;; \
  esac; \
  curl -fsSL "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-${NODE_ARCH}.tar.xz" \
    | tar -xJ -C /usr/local --strip-components=1; \
  node --version; \
  corepack enable; \
  # npm@12 requires Node ^24.15.0 or >=26.0.0, but the release image uses
  # Node 24.14.0. Stay on the npm v11 line, which is compatible.
  npm install -g npm@11; \
  npm --version

# gh CLI (not packaged in ubuntu).
RUN set -eux; \
  curl -fsSL "https://github.com/cli/cli/releases/download/v${GH_VERSION}/gh_${GH_VERSION}_linux_${TARGETARCH}.tar.gz" \
    | tar -xz -C /usr/local --strip-components=1; \
  gh --version

# Chromium system libraries.
#
# context(justinvdm, 2026-08-04): The playwright version pinned here only
# determines which *system packages* get installed; these change rarely
# across playwright releases. The browser *binary* is installed at container
# run time via the repo's own playwright-core (`pnpm exec playwright-core
# install --with-deps chromium` in run-in-container.sh), so the binary always
# matches the repo and this pin cannot silently drift the way the old
# hardcoded `playwright@1.60.0` workflow pin did (see worklog
# 2026-08-03-release-dry-run-pnpm11).
ARG PLAYWRIGHT_DEPS_VERSION=1.62.1
RUN apt-get update \
  && npx --yes "playwright@${PLAYWRIGHT_DEPS_VERSION}" install-deps chromium \
  && rm -rf /var/lib/apt/lists/*

# Corepack prompts before downloading a package manager on first use; that
# hangs non-interactive runs (e.g. `pnpm run dev` inside smoke-test projects,
# which carry no packageManager field).
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0

WORKDIR /work/repo
ENTRYPOINT ["/scripts/run-in-container.sh"]
