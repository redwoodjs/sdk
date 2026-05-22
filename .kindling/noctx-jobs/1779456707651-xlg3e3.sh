#!/usr/bin/env bash
set +e
exec > "/Users/justin/.kindling/drive/worktrees/drive-1779455985519-7pqpgt/.kindling/noctx-jobs/1779456707651-xlg3e3.stdout.log" 2> "/Users/justin/.kindling/drive/worktrees/drive-1779455985519-7pqpgt/.kindling/noctx-jobs/1779456707651-xlg3e3.stderr.log"
pnpm install
code=$?
printf 'exitCode=%s\nfinishedAt=%s\n' "$code" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "/Users/justin/.kindling/drive/worktrees/drive-1779455985519-7pqpgt/.kindling/noctx-jobs/1779456707651-xlg3e3.status"
exit $code
