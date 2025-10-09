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

# Trigger the workflow. This works now because the workflow file exists on the main branch.
echo "Triggering the 'Windows Debug Session' workflow on branch '$BRANCH'..."
gh workflow run windows-debug.yml --ref "$BRANCH"

echo "Waiting a moment for the workflow run to be created..."
sleep 5

# Get the ID of the most recent run for this workflow and branch
RUN_ID=""
for i in {1..5}; do
  RUN_ID=$(gh run list --workflow="windows-debug.yml" --branch="$BRANCH" --limit 1 --json databaseId --jq '.[0].databaseId')
  if [ -n "$RUN_ID" ]; then
    break
  fi
  sleep 2
done


if [ -z "$RUN_ID" ]; then
  echo "Could not find a recent workflow run. Please check the Actions tab in your repository."
  exit 1
fi

echo "Successfully triggered workflow. Run ID: $RUN_ID"
echo "You can view the run at: $(gh run view "$RUN_ID" --json url --jq '.url')"
echo "Waiting for the tmate SSH session to become available..."
echo "This may take a few minutes while the runner is being set up."
echo "[DEBUG] About to sleep for 30 seconds..."

# Give the run a moment to start before we begin polling the logs.
sleep 30

echo "[DEBUG] Finished sleeping. Starting poll loop."

# Poll the logs until the SSH connection string is available.
SSH_COMMAND=""
for i in {1..30}; do # Poll for up to 5 minutes (30 * 10 seconds)
  echo "[DEBUG] Polling attempt $i..."
  
  set +e
  LOGS=$(gh run view "$RUN_ID" --log 2>&1)
  GH_EXIT_CODE=$?
  set -e
  
  if [ $GH_EXIT_CODE -ne 0 ]; then
    echo "[DEBUG] 'gh run view' failed with exit code $GH_EXIT_CODE. Retrying..."
    sleep 10
    continue
  fi

  SSH_CONNECTION_LINE=$(echo "$LOGS" | grep "tmate SSH session")

  if [ -n "$SSH_CONNECTION_LINE" ]; then
    SSH_COMMAND=$(echo "$SSH_CONNECTION_LINE" | sed 's/.*::notice title=tmate SSH session:://' | tr -d '\r')
    if [ -n "$SSH_COMMAND" ]; then
        echo "[DEBUG] Found SSH command."
        break
    fi
  fi

  # Check if the run has already failed
  STATUS=$(gh run view "$RUN_ID" --json status -q '.status')
  if [ "$STATUS" == "completed" ]; then
    echo "The workflow run completed without providing an SSH connection."
    echo "Please check the logs for errors: $(gh run view "$RUN_ID" --json url -q '.url')"
    exit 1
  fi

  echo "Still waiting for session... (attempt $i of 30)"
  sleep 10
done


if [ -z "$SSH_COMMAND" ]; then
    echo "The workflow timed out without providing an SSH connection string."
    echo "Please check the workflow logs for errors."
    exit 1
fi

# Display the command for the user
echo ""
echo "=========================================="
echo "          SSH Session Ready"
echo "=========================================="
echo "Connecting to the remote session now..."
echo "The session will remain active for up to 60 minutes."
echo "=========================================="
echo ""

# Execute the SSH command
eval "$SSH_COMMAND"
