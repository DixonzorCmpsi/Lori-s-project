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

# Load env from root .env (for Google OAuth keys etc)
if [ -f "../.env" ]; then
  set -a
  source "../.env"
  set +a
fi

# Override DATABASE_URL to use SQLite for local dev
# Supabase PostgreSQL is for production deployment
export DATABASE_URL="sqlite+aiosqlite:///./callboard.db"

echo ""
echo "  Digital Call Board — Backend"
echo "  http://localhost:8000"
echo "  API docs: http://localhost:8000/docs"
echo "  Database: SQLite (local dev)"
echo ""

.venv/bin/uvicorn app.main:app --reload --port 8000
