#!/bin/bash
# Sminventory Stop Script

PROJECT_DIR="/mnt/e/Sminventory"
RUNTIME_DIR="$PROJECT_DIR/.runtime"
PID_FILE="$RUNTIME_DIR/server.pid"

echo "Stopping Sminventory Server..."

if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")

    if ps -p "$PID" > /dev/null 2>&1; then
        kill "$PID"
        sleep 2

        # Force kill if still running
        if ps -p "$PID" > /dev/null 2>&1; then
            kill -9 "$PID"
        fi

        rm -f "$PID_FILE"
        echo "✓ Server stopped (PID: $PID)"
    else
        echo "✗ Server process not found (PID: $PID)"
        rm -f "$PID_FILE"
    fi
else
    echo "✗ No PID file found. Attempting to kill by port..."
    pkill -f "next dev -p 6660"
    echo "✓ Killed any running Next.js servers"
fi

# Verify port is free
if ss -tuln | grep -q ":6660 "; then
    echo "✗ Warning: Port 6660 is still in use"
else
    echo "✓ Port 6660 is now free"
fi
