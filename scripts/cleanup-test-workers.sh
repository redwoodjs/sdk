#!/bin/bash

# Cleanup script for test workers
# Lists all workers and deletes those matching test patterns

set -e

# Check required environment variables
if [ -z "$CLOUDFLARE_ACCOUNT_ID" ]; then
    echo "❌ Error: CLOUDFLARE_ACCOUNT_ID environment variable is required"
    echo "   Set it with: export CLOUDFLARE_ACCOUNT_ID='your-account-id'"
    exit 1
fi

if [ -z "$CLOUDFLARE_API_TOKEN" ]; then
    echo "❌ Error: CLOUDFLARE_API_TOKEN environment variable is required"
    echo "   Set it with: export CLOUDFLARE_API_TOKEN='your-api-token'"
    exit 1
fi

DELETED_COUNT=0
FAILED_COUNT=0

echo "🧹 Cleaning up test workers..."
echo "Account ID: $CLOUDFLARE_ACCOUNT_ID"
echo ""

# Test patterns to identify test workers
test_patterns=(
    "smoke-test"
    "e2e-test"
    "test-project"
    "playground"
    "hello-world"
    "minimal"
    "standard"
    "render-apis-tarball-test"
    "render-apis-test"
    "useid-test-test"
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

echo "🔍 Identifying test workers to delete..."

# Find workers matching test patterns
test_workers=()
while IFS= read -r worker_name; do
    for pattern in "${test_patterns[@]}"; do
        if [[ "$worker_name" == *"$pattern"* ]]; then
            test_workers+=("$worker_name")
            echo "  🎯 Found test worker: $worker_name"
            break
        fi
    done
done <<< "$worker_names"

if [ ${#test_workers[@]} -eq 0 ]; then
    echo "ℹ️  No test workers found matching patterns: ${test_patterns[*]}"
    exit 0
fi

echo ""
echo "🗑️  Deleting ${#test_workers[@]} test workers..."

# Delete each test worker
for worker_name in "${test_workers[@]}"; do
    echo "  Deleting: $worker_name"
    
    delete_response=$(curl -s -X DELETE \
      -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
      "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/workers/scripts/$worker_name")
    
    if echo "$delete_response" | jq -e '.success' >/dev/null 2>&1; then
        echo "    ✅ Deleted successfully"
        DELETED_COUNT=$((DELETED_COUNT + 1))
    else
        echo "    ❌ Failed to delete:"
        echo "$delete_response" | jq -r '.errors[]?.message // "Unknown error"' | sed 's/^/      /'
        FAILED_COUNT=$((FAILED_COUNT + 1))
    fi
done

echo ""
echo "🎯 Cleanup Summary:"
echo "  ✅ Workers deleted: $DELETED_COUNT"
echo "  ❌ Failed deletions: $FAILED_COUNT"
echo ""

if [ $DELETED_COUNT -gt 0 ]; then
    echo "✨ Successfully cleaned up $DELETED_COUNT test workers!"
    echo "   This should help resolve the 500 worker limit issue."
else
    echo "⚠️  No test workers were deleted."
    echo "   You may need to manually review workers in the dashboard:"
    echo "   https://dash.cloudflare.com/$CLOUDFLARE_ACCOUNT_ID/workers-and-pages"
fi
