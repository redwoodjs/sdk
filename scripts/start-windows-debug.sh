#!/bin/sh
set -e

# Get the current branch name
BRANCH=$(git branch --show-current)

echo "🚀 Triggering the 'Windows Debug Session' on branch '$BRANCH'..."

# Trigger the workflow on the current branch
gh workflow run windows-debug.yml --ref "$BRANCH"

echo "✅ Workflow triggered successfully."
echo "⏳ Go to the workflow run URL to find the SSH connection details in the log."
