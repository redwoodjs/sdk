#!/usr/bin/env bash
set -e

cd "$(dirname "$0")/.."

(cd sdk && pnpm build)

cd playground

args=()
for arg in "$@"; do
  if [[ "$arg" == playground/* ]]; then
    args+=("${arg#playground/}")
  else
    args+=("$arg")
  fi
done

vitest run "${args[@]}"
