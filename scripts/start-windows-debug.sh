#!/bin/sh
set -e

# Get the current branch name
BRANCH=$(git branch --show-current)
TUNNEL_NAME=$1

# Get git user config from local repository
GIT_USER_NAME=$(git config user.name || echo "")
GIT_USER_EMAIL=$(git config user.email || echo "")

# Get Cloudflare credentials from local environment
CLOUDFLARE_ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:-}"
CLOUDFLARE_API_TOKEN="${CLOUDFLARE_API_TOKEN:-}"

echo "🚀 Triggering the 'Windows Debug Session' on branch '$BRANCH'..."

# Build workflow input arguments
WORKFLOW_ARGS="--ref $BRANCH"
if [ -n "$TUNNEL_NAME" ]; then
  echo "  - Using tunnel name: $TUNNEL_NAME"
  WORKFLOW_ARGS="$WORKFLOW_ARGS -f cursorTunnelName=$TUNNEL_NAME"
fi
if [ -n "$GIT_USER_NAME" ]; then
  WORKFLOW_ARGS="$WORKFLOW_ARGS -f gitUserName=$GIT_USER_NAME"
fi
if [ -n "$GIT_USER_EMAIL" ]; then
  WORKFLOW_ARGS="$WORKFLOW_ARGS -f gitUserEmail=$GIT_USER_EMAIL"
fi
if [ -n "$CLOUDFLARE_ACCOUNT_ID" ]; then
  WORKFLOW_ARGS="$WORKFLOW_ARGS -f cloudflareAccountId=$CLOUDFLARE_ACCOUNT_ID"
fi
if [ -n "$CLOUDFLARE_API_TOKEN" ]; then
  WORKFLOW_ARGS="$WORKFLOW_ARGS -f cloudflareApiToken=$CLOUDFLARE_API_TOKEN"
fi

# Trigger the workflow (don't exit on failure)
WORKFLOW_TRIGGERED=false
if gh workflow run windows-debug.yml $WORKFLOW_ARGS 2>/dev/null; then
  WORKFLOW_TRIGGERED=true
  echo "✅ Workflow triggered. Waiting a few seconds to get the run URL..."
  sleep 5 # Give GitHub a moment to create the run
  
  # Get the URL of the most recent run for this workflow and branch
  RUN_URL=$(gh run list --workflow="windows-debug.yml" --branch="$BRANCH" --limit 1 --json url -q '.[0].url' 2>/dev/null || echo "")
  
  if [ -n "$RUN_URL" ]; then
    echo "✅ Workflow run URL found:"
    echo "$RUN_URL"
  else
    echo "⚠️  Could not retrieve the workflow run URL automatically."
  fi
else
  echo "⚠️  Could not trigger workflow via workflow_dispatch (this is expected if testing on a branch)."
  echo "   The workflow will run automatically when you push (if push trigger is configured)."
fi

# Always show instructions regardless of success/failure
if [ "$WORKFLOW_TRIGGERED" = "false" ]; then
  echo ""
  echo "To trigger the workflow manually, you can:"
  echo "  1. Create/update a '.trigger-debug' file and push it"
  echo "  2. Or push any change to the workflow file"
  echo ""
  REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || echo "")
  if [ -n "$REPO" ]; then
    echo "Then find the run in: https://github.com/$REPO/actions/workflows/windows-debug.yml"
  else
    echo "Then find the run in the GitHub Actions tab."
  fi
  echo ""
fi

echo ""
echo "Next Steps:"
echo "1. Open the URL and wait for the tmate SSH connection string."
echo "2. Connect to the runner via SSH."
echo "3. PowerShell will automatically launch and start the Cursor tunnel."
echo "4. Once connected, you'll be in the repository root (D:\a\sdk\sdk)"
echo "5. Connect to the tunnel from Cursor's Command Palette."
echo "6. In Cursor, click 'Open Folder' and enter the path: D:\a\sdk\sdk"
echo ""
echo "Note: Git user config has been set from your local repository."
echo ""
echo "---"
echo "Alternative Method (if Cursor tunnel fails):"
echo "You can use VS Code's tunnel service. This requires modifying the workflow to download"
echo "the 'vscode' CLI and then manually installing the 'Remote - Tunnels' extension in Cursor."
echo ""
echo "1. Download the VSIX file for 'ms-vscode.remote-tunnels' from the VS Code Marketplace."
echo "2. In Cursor, open Command Palette > 'Extensions: Install from VSIX...' and select the file."
echo "3. Modify '.github/workflows/windows-debug.yml' to prepare the 'vscode' CLI instead of 'cursor'."
