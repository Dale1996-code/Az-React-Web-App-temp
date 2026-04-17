#!/usr/bin/env bash
# Start both the API and web frontend for local development.
# Requires: Node 22 LTS, npm
# Usage: ./start-dev.sh

set -e

echo "=== Installing API dependencies ==="
(cd src/api && npm ci --silent)

echo "=== Installing Web dependencies ==="
(cd src/web && npm ci --silent)

echo "=== Building API ==="
(cd src/api && npm run build)

echo "=== Starting API (port 3100) and Web (port 5173) ==="
echo "API:  http://localhost:3100"
echo "Web:  http://localhost:5173"
echo ""

# Start both processes; kill all on Ctrl+C
trap 'kill 0' EXIT

(cd src/api && NODE_ENV=development npm start) &
(cd src/web && npm run dev) &

wait
