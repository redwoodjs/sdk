#!/bin/bash

# Quick cleanup script for test workers
# Lists workers and shows which ones would be deleted (dry-run mode by default)

set -e

# Check required environment variables
if [ -z "$CLOUDFLARE_ACCOUNT_ID" ]; then
    echo "❌ Error: CLOUDFLARE_ACCOUNT_ID environment variable is required"
    echo "   Set it with: export CLOUDFLARE_ACCOUNT_ID='your-account-id'"
    exit 1
fi

if [ -z "$CLOUDFLARE_API_TOKEN" ]; then
    echo "❌ Error: CF_API_TOKEN environment variable is required"
    echo "   Set it with: export CF_API_TOKEN='your-api-token'"
    exit 1
fi

# Check if this is a dry run (default) or actual deletion
DRY_RUN=true
if [ "$1" = "--delete" ]; then
    DRY_RUN=false
    echo "🚨 DELETION MODE: Will actually delete test workers"
else
    echo "🔍 DRY RUN MODE: Will only show what would be deleted"
    echo "   Use --delete flag to actually delete workers"
fi

echo "Account ID: $CLOUDFLARE_ACCOUNT_ID"
echo ""

# Test patterns to identify test workers
test_patterns=(
    "smoke-test"
    "e2e-test"
    "test-project"
    "playground"
)

echo "📋 Fetching list of all workers..."

# Get list of all workers
workers_response=$(curl -s -X GET \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/workers/scripts")

# Check if API call was successful
if ! echo "$workers_response" | jq -e '.success' >/dev/null 2>&1; then
    echo "❌ Failed to fetch workers list:"
    echo "$workers_response" | jq -r '.errors[]?.message // "Unknown error"'
    exit 1
fi

# Extract worker names
worker_names=$(echo "$workers_response" | jq -r '.result[]?.id // empty')

if [ -z "$worker_names" ]; then
    echo "ℹ️  No workers found in account"
    exit 0
fi

total_workers=$(echo "$worker_names" | wc -l | tr -d ' ')
echo "📊 Found $total_workers total workers"
echo ""

echo "🔍 Test workers found:"

# Find and optionally delete workers matching test patterns
test_workers=()
while IFS= read -r worker_name; do
    for pattern in "${test_patterns[@]}"; do
        if [[ "$worker_name" == *"$pattern"* ]]; then
            test_workers+=("$worker_name")
            if [ "$DRY_RUN" = true ]; then
                echo "  🎯 Would delete: $worker_name"
            else
                echo "  🗑️  Deleting: $worker_name"
                
                delete_response=$(curl -s -X DELETE \
                  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
                  "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/workers/scripts/$worker_name")
                
                if echo "$delete_response" | jq -e '.success' >/dev/null 2>&1; then
                    echo "     ✅ Deleted successfully"
                else
                    echo "     ❌ Failed to delete"
                fi
            fi
            break
        fi
    done
done <<< "$worker_names"

echo ""
echo "📊 Summary:"
echo "  Total workers: $total_workers"
echo "  Test workers found: ${#test_workers[@]}"

if [ ${#test_workers[@]} -eq 0 ]; then
    echo ""
    echo "ℹ️  No test workers found matching patterns: ${test_patterns[*]}"
    echo ""
    echo "📋 Manual cleanup options:"
    echo "1. Visit Cloudflare Dashboard:"
    echo "   https://dash.cloudflare.com/$CLOUDFLARE_ACCOUNT_ID/workers-and-pages"
    echo ""
    echo "2. Look for workers with random names that might be from tests"
elif [ "$DRY_RUN" = true ]; then
    echo ""
    echo "🚀 To actually delete these workers, run:"
    echo "   ./scripts/quick-cleanup.sh --delete"
else
    echo ""
    echo "✨ Cleanup completed!"
fi
