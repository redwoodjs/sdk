#!/usr/bin/env bash
set +e
exec > "/Users/justin/.kindling/drive/worktrees/drive-1779455985519-7pqpgt/.kindling/noctx-jobs/1779456826107-cy97me.stdout.log" 2> "/Users/justin/.kindling/drive/worktrees/drive-1779455985519-7pqpgt/.kindling/noctx-jobs/1779456826107-cy97me.stderr.log"
AI_AGENT=1 npx @redwoodjs/agent-ci run --all
code=$?
printf 'exitCode=%s\nfinishedAt=%s\n' "$code" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "/Users/justin/.kindling/drive/worktrees/drive-1779455985519-7pqpgt/.kindling/noctx-jobs/1779456826107-cy97me.status"
exit $code
