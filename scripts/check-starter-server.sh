#!/usr/bin/env bash
set -euo pipefail

# Parse arguments
mode="dev"
port=""
starter_dir=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --port)
      port="$2"
      shift 2
      ;;
    --mode)
      mode="$2"
      if [[ "$mode" != "dev" && "$mode" != "preview" ]]; then
        echo "Error: mode must be either 'dev' or 'preview'"
        exit 1
      fi
      shift 2
      ;;
    *)
      starter_dir="$1"
      shift
      ;;
  esac
done

if [ ! -d "$starter_dir" ]; then
  echo "Error: $starter_dir is not a directory"
  exit 1
fi

# Calculate port if not provided
if [ -z "$port" ]; then
  starter_name=$(basename "$starter_dir")
  port=$(( 3000 + $(echo "$starter_name" | cksum | cut -d' ' -f1) % 1000 ))
fi

echo "Testing $starter_dir on port $port in $mode mode"

# Start the server
cd "$starter_dir"
pnpm "$mode" --port "$port" &
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