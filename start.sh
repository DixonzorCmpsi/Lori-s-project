#!/bin/bash
# Start both backend and frontend together
set -e

DIR="$(dirname "$0")"

echo "Starting Digital Call Board..."
echo ""

# Start backend in background
"$DIR/start-backend.sh" &
BACKEND_PID=$!

# Wait for backend to be ready
sleep 2

# Start frontend in background
"$DIR/start-frontend.sh" &
FRONTEND_PID=$!

echo ""
echo "  Backend:  http://localhost:8000"
echo "  Frontend: http://localhost:5173"
echo "  API Docs: http://localhost:8000/docs"
echo ""
echo "  Press Ctrl+C to stop both servers"
echo ""

# Wait for either to exit
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM
wait
