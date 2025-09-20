#!/bin/bash

# Quick cleanup script for test workers
# Focuses on the most likely patterns based on the error message

ACCOUNT_ID="1634a8e653b2ce7e0f7a23cca8cbd86a"
DELETED_COUNT=0

echo "🧹 Quick cleanup of test workers..."
echo ""

# Try the exact worker from the error message first
echo "Trying exact worker from error message..."
if CLOUDFLARE_ACCOUNT_ID="$ACCOUNT_ID" npx wrangler delete --name "test-project-smoke-test-defeated-cat-c6cefbc2" --force >/dev/null 2>&1; then
    echo "  ✅ Deleted: test-project-smoke-test-defeated-cat-c6cefbc2"
    DELETED_COUNT=$((DELETED_COUNT + 1))
else
    echo "  ❌ Not found: test-project-smoke-test-defeated-cat-c6cefbc2"
fi

# Try some variations of the pattern
patterns=(
    "test-project-smoke-test-"
    "hello-world-smoke-test-"
    "minimal-smoke-test-"
    "standard-smoke-test-"
    "playground-e2e-test-"
)

# Some realistic animal-hex combinations
realistic_suffixes=(
    "defeated-cat-c6cefbc2"
    "happy-dog-a1b2c3d4"
    "clever-fox-e5f6g7h8"
    "swift-bird-i9j0k1l2"
    "brave-lion-m3n4o5p6"
)

echo ""
echo "Trying common test worker patterns..."

for pattern in "${patterns[@]}"; do
    echo "Pattern: $pattern*"
    for suffix in "${realistic_suffixes[@]}"; do
        worker_name="${pattern}${suffix}"
        if CLOUDFLARE_ACCOUNT_ID="$ACCOUNT_ID" npx wrangler delete --name "$worker_name" --force >/dev/null 2>&1; then
            echo "  ✅ Deleted: $worker_name"
            DELETED_COUNT=$((DELETED_COUNT + 1))
        fi
    done
done

echo ""
echo "🎯 Quick cleanup completed: $DELETED_COUNT workers deleted"
echo ""

if [ $DELETED_COUNT -eq 0 ]; then
    echo "ℹ️  No test workers found with common patterns."
    echo ""
    echo "📋 Manual cleanup options:"
    echo "1. Visit Cloudflare Dashboard:"
    echo "   https://dash.cloudflare.com/$ACCOUNT_ID/workers-and-pages"
    echo ""
    echo "2. Look for workers with these patterns in their names:"
    echo "   - smoke-test"
    echo "   - e2e-test"  
    echo "   - test-project"
    echo "   - playground"
    echo "   - hello-world"
    echo "   - minimal"
    echo "   - standard"
    echo ""
    echo "3. Delete workers that look like temporary test deployments"
    echo "   (usually have random animal names and hex suffixes)"
else
    echo "✨ Cleaned up $DELETED_COUNT test workers!"
    echo "   If you still hit the 500 worker limit, run this script again"
    echo "   or manually clean up via the dashboard."
fi
