#!/bin/bash

# A script to start a remote debug session on a Windows runner via GitHub Actions.

set -e # Exit immediately if a command exits with a non-zero status.
set -o pipefail # The return value of a pipeline is the status of the last command to exit with a non-zero status.

echo "Looking for GitHub CLI 'gh'..."
if ! command -v gh &> /dev/null
then
    echo "'gh' command could not be found."
    echo "Please install the GitHub CLI: https://cli.github.com/"
    exit 1
fi

echo "Authenticating with GitHub..."
gh auth status

# Get the current branch name
BRANCH=$(git branch --show-current)
if [ -z "$BRANCH" ]; then
  echo "Could not determine the current git branch."
  exit 1
fi
echo "Current branch is '$BRANCH'."

# Trigger the workflow
echo "Triggering the 'Windows Debug Session' workflow on branch '$BRANCH'..."
# The `gh workflow run` command outputs the URL to the run, which is nice.
gh workflow run windows-debug.yml --ref "$BRANCH"

echo "Waiting a moment for the workflow run to be created..."
sleep 5

# Get the ID of the most recent run for this workflow and branch
RUN_ID=$(gh run list --workflow="windows-debug.yml" --branch="$BRANCH" --limit 1 --json databaseId --jq '.[0].databaseId')

if [ -z "$RUN_ID" ]; then
  echo "Could not find a recent workflow run. Please check the Actions tab in your repository."
  exit 1
fi

echo "Successfully triggered workflow. Run ID: $RUN_ID"
echo "You can view the run at: $(gh run view "$RUN_ID" --web --json url --jq '.url')"
echo "Waiting for the tmate SSH session to become available..."
echo "This may take a few minutes while the runner is being set up."

# Stream the logs and wait for the line containing the SSH connection string.
# `grep -m 1` will exit after finding the first match.
# When `grep` exits, the pipe is broken, which should cause `gh run watch` to terminate.
SSH_CONNECTION_LINE=$(gh run watch "$RUN_ID" | grep -m 1 "tmate SSH session")

if [ -z "$SSH_CONNECTION_LINE" ]; then
    echo "The workflow finished without providing an SSH connection string."
    echo "Please check the workflow logs for errors."
    exit 1
fi

# Extract just the SSH command
SSH_COMMAND=$(echo "$SSH_CONNECTION_LINE" | sed 's/.*::notice title=tmate SSH session:://')

# Display the command for the user
echo ""
echo "=========================================="
echo "          SSH Session Ready"
echo "=========================================="
echo "To connect, copy and paste the following command into your terminal:"
echo ""
echo "  $SSH_COMMAND"
echo ""
echo "The session will remain active for up to 60 minutes."
echo "=========================================="
