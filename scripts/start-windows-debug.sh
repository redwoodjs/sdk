#!/bin/sh
set -e

# Get the current branch name
BRANCH=$(git branch --show-current)

echo "🚀 Triggering the 'Windows Debug Session' on branch '$BRANCH'..."

# Trigger the workflow on the current branch
gh workflow run windows-debug.yml --ref "$BRANCH"

echo "✅ Workflow triggered. Waiting a few seconds to get the run URL..."
sleep 5 # Give GitHub a moment to create the run

# Get the URL of the most recent run for this workflow and branch
RUN_URL=$(gh run list --workflow="windows-debug.yml" --branch="$BRANCH" --limit 1 --json url -q '.[0].url')

if [ -z "$RUN_URL" ]; then
  echo "❌ Could not retrieve the workflow run URL. Please find it manually in the Actions tab of your repository."
  exit 1
fi

echo "✅ Workflow run URL found:"
echo "$RUN_URL"
echo ""
echo "⏳ Please open the URL and find the SSH connection details in the log."
