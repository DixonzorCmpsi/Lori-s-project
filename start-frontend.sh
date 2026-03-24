#!/bin/bash
# Start the Digital Call Board frontend dev server
set -e

cd "$(dirname "$0")/frontend"

# Install deps if needed
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi

echo ""
echo "  Digital Call Board — Frontend"
echo "  http://localhost:5173"
echo ""

npm run dev
