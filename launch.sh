#!/bin/bash
# Sminventory Launcher - WSL Bash version
# This script is more reliable than the PowerShell version

set -e  # Exit on error

PROJECT_DIR="/mnt/e/Sminventory"
RUNTIME_DIR="$PROJECT_DIR/.runtime"
LOG_FILE="$RUNTIME_DIR/server.log"
PID_FILE="$RUNTIME_DIR/server.pid"

# Create runtime directory if it doesn't exist
mkdir -p "$RUNTIME_DIR"

cd "$PROJECT_DIR"

echo "========================================"
echo "  Sminventory Launcher"
echo "========================================"
echo ""

# Check if server is already running
if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if ps -p "$PID" > /dev/null 2>&1; then
        echo "✓ Server is already running (PID: $PID)"
        echo "✓ Opening browser and log viewer..."

        # Open browser
        cmd.exe /c start http://localhost:6660 2>/dev/null

        # Open log viewer in new PowerShell window
        cmd.exe /c start powershell -NoExit -Command "Write-Host 'Sminventory Server Logs' -ForegroundColor Cyan; Write-Host ''; Get-Content E:\\Sminventory\\.runtime\\server.log -Wait -Tail 50" 2>/dev/null

        echo "✓ Done!"
        exit 0
    else
        # PID file exists but process is dead
        rm -f "$PID_FILE"
    fi
fi

# Clear old log file
> "$LOG_FILE"

echo "✓ Starting Next.js server on port 6660..."

# Start server in background
npm run dev >> "$LOG_FILE" 2>&1 &
SERVER_PID=$!

# Save PID
echo $SERVER_PID > "$PID_FILE"

echo "✓ Server started (PID: $SERVER_PID)"
echo "✓ Waiting for server to be ready..."

# Wait for port to be listening (max 60 seconds)
for i in {1..60}; do
    if ss -tuln | grep -q ":6660 "; then
        echo "✓ Server is ready!"
        break
    fi
    sleep 1
    echo -n "."
done

echo ""

# Check if server actually started
if ! ss -tuln | grep -q ":6660 "; then
    echo "✗ Error: Server failed to start on port 6660"
    echo "✗ Check $LOG_FILE for errors"
    exit 1
fi

echo "✓ Opening browser..."
cmd.exe /c start http://localhost:6660 2>/dev/null

sleep 2

echo "✓ Opening log viewer..."
cmd.exe /c start powershell -NoExit -Command "Write-Host '══════════════════════════════════════════════════════' -ForegroundColor Cyan; Write-Host '    SMINVENTORY SERVER LOGS - PORT 6660' -ForegroundColor Cyan; Write-Host '══════════════════════════════════════════════════════' -ForegroundColor Cyan; Write-Host ''; Write-Host 'Server URL: http://localhost:6660' -ForegroundColor Green; Write-Host 'Log file: E:\\Sminventory\\.runtime\\server.log' -ForegroundColor Yellow; Write-Host ''; Write-Host 'Press Ctrl+C to stop monitoring (server will keep running)' -ForegroundColor Gray; Write-Host 'Run stop.sh to stop the server' -ForegroundColor Gray; Write-Host ''; Write-Host '──────────────────────────────────────────────────────' -ForegroundColor DarkGray; Write-Host ''; Get-Content E:\\Sminventory\\.runtime\\server.log -Wait -Tail 50" 2>/dev/null

echo ""
echo "========================================"
echo "✓ Sminventory is running!"
echo "  URL: http://localhost:6660"
echo "  PID: $SERVER_PID"
echo "  Log: $LOG_FILE"
echo ""
echo "To stop: ./stop.sh"
echo "========================================"
