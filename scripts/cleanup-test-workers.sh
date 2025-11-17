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
#
# Max age of a worker in seconds
# Defaults to 1 hour
MAX_WORKER_AGE_SECONDS=${MAX_WORKER_AGE_SECONDS:-3600}

# Max number of workers to delete in a single run
# Defaults to 100
MAX_WORKERS_TO_DELETE=${MAX_WORKERS_TO_DELETE:-500}

# Enable debug mode
# Defaults to false
DEBUG=${DEBUG:-false}

echo "🧹 Cleaning up test workers..."
echo "Account ID: $CLOUDFLARE_ACCOUNT_ID"
echo "Worker max age: $MAX_WORKER_AGE_SECONDS seconds"
echo "Max workers to delete: $MAX_WORKERS_TO_DELETE"
echo ""

# Test patterns to identify test workers
test_patterns=(
    "-test-"
    "-t-"
    "smoke-test"
    "e2e-test"
    "test-project"
    "playground"
    "hello-world"
    "starter"
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

total_workers=$(echo "$workers_response" | jq -r '.result | length')
echo "📊 Found $total_workers total workers"
echo ""

echo "🔍 Identifying old test workers to delete..."

# Build regex from patterns for jq
patterns_regex=$(printf "%s|" "${test_patterns[@]}")
patterns_regex=${patterns_regex%|}

if [ "$DEBUG" = true ]; then
    echo "🐛 DEBUG: Using regex pattern: $patterns_regex"
    echo "🐛 DEBUG: All worker names found:"
    echo "$workers_response" | jq -r '.result[].id' | sed 's/^/    - /'

    echo "🐛 DEBUG: Workers matching patterns:"
    echo "$workers_response" | jq -r \
        --arg patterns "$patterns_regex" \
        '
        .result
        | map(select(.id | test($patterns)))
        | .[] | "  - \(.id) (created: \(.created_on))"
        '

    echo "🐛 DEBUG: Workers matching patterns and age criteria:"
    echo "$workers_response" | jq -r \
        --arg patterns "$patterns_regex" \
        --argjson age "$MAX_WORKER_AGE_SECONDS" \
        '
        .result
        | map(select(.id | test($patterns)))
        | map(select(.created_on and ((now - (.created_on | sub("\\.\\d+Z$"; "Z") | fromdateiso8601)) > $age)))
        | .[] | "  - \(.id) (created: \(.created_on))"
        '
fi

# Get worker IDs to delete
# - Filter by name patterns
# - Filter by age
# - Sort by creation date (oldest first)
# - Limit number to delete
worker_names_to_delete=$(echo "$workers_response" | jq -r \
    --arg patterns "$patterns_regex" \
    --argjson age "$MAX_WORKER_AGE_SECONDS" \
    --argjson limit "$MAX_WORKERS_TO_DELETE" \
    '
    .result
    | map(select(.id | test($patterns)))
    | map(select(.created_on and ((now - (.created_on | sub("\\.\\d+Z$"; "Z") | fromdateiso8601)) > $age)))
    | sort_by(.created_on)
    | .[:$limit]
    | .[].id
    '
)

if [ -z "$worker_names_to_delete" ]; then
    echo "ℹ️  No test workers found matching patterns and age criteria."
    exit 0
fi

total_to_delete=$(echo "$worker_names_to_delete" | wc -l | tr -d ' ')

echo "🗑️  Identified $total_to_delete workers to delete"

# Delete each test worker
while IFS= read -r worker_name; do
    if [ -z "$worker_name" ]; then
        continue
    fi

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
done <<< "$worker_names_to_delete"

echo ""
echo "🎯 Cleanup Summary:"
echo "  ✅ Workers deleted: $DELETED_COUNT"
echo "  ❌ Failed deletions: $FAILED_COUNT"
echo ""

if [ $DELETED_COUNT -gt 0 ]; then
    echo "✨ Successfully cleaned up $DELETED_COUNT test workers!"
else
    echo "⚠️  No test workers were deleted."
fi

if [ $FAILED_COUNT -eq 0 ]; then
    echo "   This should help resolve the 500 worker limit issue."
else
    echo "   You may need to manually review workers in the dashboard:"
    echo "   https://dash.cloudflare.com/$CLOUDFLARE_ACCOUNT_ID/workers-and-pages"
fi
