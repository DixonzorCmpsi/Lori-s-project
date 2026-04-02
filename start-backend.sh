#!/bin/bash
# Start the Digital Call Board backend server
set -e

cd "$(dirname "$0")/backend"

# Create venv if it doesn't exist
if [ ! -d ".venv" ]; then
  echo "Creating Python virtual environment..."
  python3 -m venv .venv
  echo "Installing dependencies..."
  .venv/bin/pip install -r requirements.txt
fi

# Check if deps are installed
if ! .venv/bin/python3 -c "import fastapi" 2>/dev/null; then
  echo "Installing dependencies..."
  .venv/bin/pip install -r requirements.txt
fi

# Load env from root .env
if [ -f "../.env" ]; then
  set -a
  source "../.env"
  set +a
fi

echo ""
echo "  Digital Call Board — Backend"
echo "  http://localhost:8000"
echo "  API docs: http://localhost:8000/docs"
echo "  Database: Supabase PostgreSQL"
echo ""

.venv/bin/uvicorn app.main:app --reload --port 8000
