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
echo "Waiting for the workflow to upload the SSH connection artifact..."
echo "This may take a few minutes while the runner is being set up."

# Wait for the run to complete. The artifact is only available after the run is complete.
# However, our run has a 60-minute sleep, so we can't wait for completion.
# Instead, we will poll for the artifact.

ARTIFACT_DIR=$(mktemp -d)

for i in {1..30}; do # Poll for up to 5 minutes
    if gh run download "$RUN_ID" -n tmate-ssh-string -D "$ARTIFACT_DIR"; then
        echo "Successfully downloaded SSH connection artifact."
        break
    fi
    echo "Artifact not yet available. Waiting 10 seconds... (attempt $i of 30)"
    sleep 10
done

if [ ! -f "$ARTIFACT_DIR/tmate-ssh-string.txt" ]; then
    echo "Could not download the SSH connection artifact."
    echo "Please check the workflow run for errors."
    exit 1
fi

SSH_COMMAND=$(cat "$ARTIFACT_DIR/tmate-ssh-string.txt")
rm -rf "$ARTIFACT_DIR" # Clean up temp directory

if [ -z "$SSH_COMMAND" ]; then
    echo "The SSH connection string is empty."
    exit 1
fi

# Display the command for the user
echo ""
echo "=========================================="
echo "          SSH Session Ready"
echo "=========================================="
echo "Connecting to the remote session now..."
echo "The session will remain active for up to 60 minutes."
echo "==========================================="
echo ""

# Execute the SSH command
eval "$SSH_COMMAND"
