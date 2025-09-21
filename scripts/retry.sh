#!/bin/bash

# Retry script for CI commands
# Usage: ./scripts/retry.sh <command> [args...]

set -e

MAX_RETRIES=6
RETRY_COUNT=0
COMMAND="$@"

echo "Running command with up to $MAX_RETRIES retries: $COMMAND"

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    RETRY_COUNT=$((RETRY_COUNT + 1))
    echo "Attempt $RETRY_COUNT of $MAX_RETRIES"
    
    if eval "$COMMAND"; then
        echo "Command succeeded on attempt $RETRY_COUNT"
        exit 0
    else
        EXIT_CODE=$?
        echo "Command failed on attempt $RETRY_COUNT with exit code $EXIT_CODE"
        
        if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
            echo "All $MAX_RETRIES attempts failed"
            exit $EXIT_CODE
        else
            echo "Retrying in 5 seconds..."
            sleep 5
        fi
    fi
done
