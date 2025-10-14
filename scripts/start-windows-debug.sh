#!/bin/sh
set -e

# Get the current branch name
BRANCH=$(git branch --show-current)
TUNNEL_NAME=$1

echo "🚀 Triggering the 'Windows Debug Session' on branch '$BRANCH'..."

# Trigger the workflow on the current branch, passing the tunnel name if provided
if [ -z "$TUNNEL_NAME" ]; then
  gh workflow run windows-debug.yml --ref "$BRANCH"
else
  echo "  - Using tunnel name: $TUNNEL_NAME"
  gh workflow run windows-debug.yml --ref "$BRANCH" -f cursorTunnelName="$TUNNEL_NAME"
fi

echo "✅ Workflow triggered. Waiting a few seconds to get the run URL..."
sleep 5 # Give GitHub a moment to create the run

# Get the URL of the most recent run for this workflow and branch
RUN_URL=$(gh run list --workflow="windows-debug.yml" --branch="$BRANCH" --limit 1 --json url -q '.[0].url')

if [ -z "$RUN_URL" ]; then
  echo "❌ Could not retrieve the workflow run URL. Please find it manually in the Actions tab."
  exit 1
fi

echo "✅ Workflow run URL found:"
echo "$RUN_URL"
echo ""
echo "Next Steps:"
echo "1. Open the URL and wait for the tmate SSH connection string."
echo "2. Connect to the runner via SSH."
echo "3. Once connected, type 'powershell' to enter a PowerShell session."
echo "4. Navigate to the repository root:"
echo "   cd D:\a\sdk\sdk"
echo "   (Dependencies are pre-installed for you)"
echo "5. Run the tunnel command below and authenticate in your browser."
echo ""
if [ -z "$TUNNEL_NAME" ]; then
  echo "   & '.\.tmp\cursor_cli\cursor.exe' tunnel --random-name --verbose"
else
  echo "   & '.\.tmp\cursor_cli\cursor.exe' tunnel --name '$TUNNEL_NAME' --verbose"
fi
echo ""
echo "6. Connect to the tunnel from Cursor's Command Palette."
echo "7. In Cursor, click 'Open Folder' and enter the path: D:\a\sdk\sdk"
echo ""
echo "---"
echo "Alternative Method (if Cursor tunnel fails):"
echo "You can use VS Code's tunnel service. This requires modifying the workflow to download"
echo "the 'vscode' CLI and then manually installing the 'Remote - Tunnels' extension in Cursor."
echo ""
echo "1. Download the VSIX file for 'ms-vscode.remote-tunnels' from the VS Code Marketplace."
echo "2. In Cursor, open Command Palette > 'Extensions: Install from VSIX...' and select the file."
echo "3. Modify '.github/workflows/windows-debug.yml' to prepare the 'vscode' CLI instead of 'cursor'."
