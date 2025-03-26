#!/usr/bin/env bash
set -euo pipefail

starter_dir=$1
if [ ! -d "$starter_dir" ]; then
  echo "Error: $starter_dir is not a directory"
  exit 1
fi

# Calculate port (using the last part of the path to ensure consistent ports per starter)
starter_name=$(basename "$starter_dir")
# Use hash of name to generate port (between 3000-3999)
port=$(( 3000 + $(echo "$starter_name" | cksum | cut -d' ' -f1) % 1000 ))

echo "Testing $starter_dir on port $port"

# Start the dev server
cd "$starter_dir"
DEV_SERVER_PORT=$port pnpm dev &
server_pid=$!

# Try to connect to the server with retries
max_attempts=30
attempt=1
while [ $attempt -le $max_attempts ]; do
  echo "Attempt $attempt/$max_attempts: Checking if server is up..."
  if curl -s -f "http://localhost:$port" > /dev/null 2>&1; then
    echo "✓ Server responded successfully"
    kill $server_pid
    exit 0
  fi
  
  # Check if server process is still running
  if ! kill -0 $server_pid 2>/dev/null; then
    echo "✗ Server process died unexpectedly"
    exit 1
  fi
  
  sleep 2
  attempt=$((attempt + 1))
done

echo "✗ Server failed to respond after $max_attempts attempts"
kill $server_pid
exit 1