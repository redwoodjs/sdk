#!/bin/bash

# Cleanup script for test workers
# This script attempts to delete workers with test-related names

ACCOUNT_ID="1634a8e653b2ce7e0f7a23cca8cbd86a"
DELETED_COUNT=0
FAILED_COUNT=0

echo "🧹 Cleaning up test workers..."
echo "Account ID: $ACCOUNT_ID"
echo ""

# Common test worker name patterns based on the error message
# Example: test-project-smoke-test-defeated-cat-c6cefbc2
test_patterns=(
    "test-project-smoke-test-"
    "smoke-test-"
    "e2e-test-"
    "playground-test-"
    "hello-world-"
    "minimal-"
    "standard-"
)

# Common animal names and random suffixes used in test worker names
animals=(
    "defeated-cat" "happy-dog" "clever-fox" "swift-bird" "brave-lion" "wise-owl"
    "quick-rabbit" "strong-bear" "gentle-deer" "proud-eagle" "calm-turtle"
    "bright-fish" "wild-wolf" "kind-sheep" "fast-horse" "small-mouse"
    "tall-giraffe" "big-elephant" "cute-panda" "red-fox" "blue-whale"
)

# Common hex suffixes (8 characters)
hex_suffixes=(
    "c6cefbc2" "a1b2c3d4" "e5f6g7h8" "i9j0k1l2" "m3n4o5p6" "q7r8s9t0"
    "1a2b3c4d" "5e6f7g8h" "9i0j1k2l" "3m4n5o6p" "7q8r9s0t" "1u2v3w4x"
    "5y6z7a8b" "9c0d1e2f" "3g4h5i6j" "7k8l9m0n" "1o2p3q4r" "5s6t7u8v"
    "9w0x1y2z" "3a4b5c6d" "7e8f9g0h" "1i2j3k4l" "5m6n7o8p" "9q0r1s2t"
)

echo "Attempting to delete workers with test patterns..."
echo "This may take a few minutes..."
echo ""

# Try to delete workers with various patterns and suffixes
for pattern in "${test_patterns[@]}"; do
    echo "🔍 Trying pattern: $pattern*"
    
    for animal in "${animals[@]}"; do
        for hex in "${hex_suffixes[@]}"; do
            worker_name="${pattern}${animal}-${hex}"
            
            # Try to delete the worker
            if CLOUDFLARE_ACCOUNT_ID="$ACCOUNT_ID" npx wrangler delete --name "$worker_name" --force >/dev/null 2>&1; then
                echo "  ✅ Deleted: $worker_name"
                DELETED_COUNT=$((DELETED_COUNT + 1))
            else
                FAILED_COUNT=$((FAILED_COUNT + 1))
            fi
            
            # Show progress every 50 attempts
            if [ $((($DELETED_COUNT + $FAILED_COUNT) % 50)) -eq 0 ]; then
                echo "  📊 Progress: $DELETED_COUNT deleted, $FAILED_COUNT not found"
            fi
        done
    done
done

echo ""
echo "🎯 Cleanup Summary:"
echo "  ✅ Workers deleted: $DELETED_COUNT"
echo "  ❌ Workers not found: $FAILED_COUNT"
echo ""

if [ $DELETED_COUNT -gt 0 ]; then
    echo "✨ Successfully cleaned up $DELETED_COUNT test workers!"
else
    echo "ℹ️  No test workers found with the attempted patterns."
    echo "   You may need to manually delete workers via the Cloudflare dashboard:"
    echo "   https://dash.cloudflare.com/1634a8e653b2ce7e0f7a23cca8cbd86a/workers-and-pages"
fi
