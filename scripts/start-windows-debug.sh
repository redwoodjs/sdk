#!/bin/sh
set -e

# Get the current branch name
BRANCH=$(git branch --show-current)

echo "🚀 Triggering the 'Windows Debug Session' on branch '$BRANCH'..."

# Trigger the workflow on the current branch
gh workflow run windows-debug.yml --ref "$BRANCH"

echo "✅ Workflow triggered."
echo "⏳ It may take a minute for the tunnel to appear in your VS Code 'Remote Explorer' tab."
echo "Look for a tunnel named 'rwsdk-win-ci'."
