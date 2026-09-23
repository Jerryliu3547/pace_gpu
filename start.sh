#!/usr/bin/env bash
set -e

PORT="${1:-8080}"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"

cd "$DIR"

echo "======================================================="
echo " Starting PACE Phoenix GPU Monitor & Rate Calculator"
echo " Port: http://localhost:$PORT"
echo "======================================================="

# Ensure dependencies are installed
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi

# Run Next.js dev server on the specified port
exec npx next dev -p "$PORT"
