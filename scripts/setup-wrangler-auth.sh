#!/bin/bash

# Setup Wrangler Authentication for E2E Tests
# This script ensures that Wrangler authentication is properly cached
# for use across all playground E2E tests in the monorepo.

set -e

echo "🔐 Setting up Wrangler authentication..."

# First, ensure user is logged in
echo "📝 Logging in to Cloudflare..."
npx wrangler login

# Force account selection prompt to ensure cache is created
# This is the same hack used in ensure-deploy-env.mts
# Use the minimal starter's wrangler config for this operation
echo "⚙️  Forcing account selection to create cache..."
npx wrangler d1 list --json --config starter/wrangler.jsonc

# Verify cache was created
CACHE_PATH="node_modules/.cache/wrangler/wrangler-account.json"
if [ -f "$CACHE_PATH" ]; then
    echo "✅ Wrangler authentication cache created successfully at: $CACHE_PATH"
    echo "🎯 All playground E2E tests can now use this authentication."
else
    echo "⚠️  Warning: Cache file not found at expected location: $CACHE_PATH"
    echo "   E2E tests may still work if authentication was successful."
fi

echo ""
echo "🚀 Setup complete! You can now run playground E2E tests with:"
echo "   pnpm test:e2e"
