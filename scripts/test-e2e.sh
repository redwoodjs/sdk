#!/usr/bin/env bash
set -e

if [[ "$1" == "--" ]]; then
  shift
fi

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
