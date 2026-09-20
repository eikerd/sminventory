# Sminventory Launcher - Windows PowerShell Version
# This launcher starts the server and opens browser + log viewer directly from PowerShell

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Sminventory Launcher" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if server is already running
$portTest = Test-NetConnection -ComputerName localhost -Port 6660 -WarningAction SilentlyContinue -ErrorAction SilentlyContinue -InformationLevel Quiet

if ($portTest) {
    Write-Host "Server is already running!" -ForegroundColor Yellow
    Write-Host "Opening browser and log viewer..." -ForegroundColor Green

    # Open browser
    Start-Process "http://localhost:6660"

    # Open log viewer
    Start-Process powershell -ArgumentList "-NoExit", "-Command", @"
`$Host.UI.RawUI.WindowTitle = 'Sminventory Server Logs'
Write-Host '══════════════════════════════════════════════════════' -ForegroundColor Cyan
Write-Host '    SMINVENTORY SERVER LOGS - PORT 6660' -ForegroundColor Cyan
Write-Host '══════════════════════════════════════════════════════' -ForegroundColor Cyan
Write-Host ''
Write-Host 'Server: http://localhost:6660' -ForegroundColor Green
Write-Host 'Press Ctrl+C to close this window' -ForegroundColor Gray
Write-Host ''
Get-Content E:\Sminventory\.runtime\server.log -Wait -Tail 50
"@

    Write-Host ""
    Write-Host "Done!" -ForegroundColor Green
    exit 0
}

# Start the server
Write-Host "Starting Next.js server on port 6660..." -ForegroundColor Green

# Create runtime directory
if (-not (Test-Path "E:\Sminventory\.runtime")) {
    New-Item -ItemType Directory -Path "E:\Sminventory\.runtime" -Force | Out-Null
}

# Clear old log
if (Test-Path "E:\Sminventory\.runtime\server.log") {
    Remove-Item "E:\Sminventory\.runtime\server.log" -Force
}

# Start server in background using WSL
$serverProcess = Start-Process wsl -ArgumentList "-e", "bash", "-c", "cd /mnt/e/Sminventory && npm run dev > .runtime/server.log 2>&1" -PassThru -WindowStyle Hidden

Write-Host "Server starting..." -ForegroundColor Yellow
Write-Host "Waiting for server to be ready..." -ForegroundColor Yellow

# Wait for server (max 60 seconds)
$maxRetries = 60
$retryCount = 0

while ($retryCount -lt $maxRetries) {
    Start-Sleep -Seconds 1
    $portCheck = Test-NetConnection -ComputerName localhost -Port 6660 -WarningAction SilentlyContinue -ErrorAction SilentlyContinue -InformationLevel Quiet

    if ($portCheck) {
        Write-Host ""
        Write-Host "Server is ready!" -ForegroundColor Green
        break
    }

    $retryCount++
    Write-Host "." -NoNewline -ForegroundColor Gray
}

if ($retryCount -ge $maxRetries) {
    Write-Host ""
    Write-Host "Error: Server took too long to start" -ForegroundColor Red
    Write-Host "Check E:\Sminventory\.runtime\server.log for errors" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "Opening browser..." -ForegroundColor Green
Start-Sleep -Seconds 2
Start-Process "http://localhost:6660"

Write-Host "Opening log viewer..." -ForegroundColor Green
Start-Sleep -Seconds 1

# Open log viewer in new PowerShell window
Start-Process powershell -ArgumentList "-NoExit", "-Command", @"
`$Host.UI.RawUI.WindowTitle = 'Sminventory Server Logs'
Write-Host '══════════════════════════════════════════════════════' -ForegroundColor Cyan
Write-Host '    SMINVENTORY SERVER LOGS - PORT 6660' -ForegroundColor Cyan
Write-Host '══════════════════════════════════════════════════════' -ForegroundColor Cyan
Write-Host ''
Write-Host 'Server: http://localhost:6660' -ForegroundColor Green
Write-Host 'Log: E:\Sminventory\.runtime\server.log' -ForegroundColor Yellow
Write-Host ''
Write-Host 'This shows real-time server logs and API calls' -ForegroundColor Gray
Write-Host 'Press Ctrl+C to close (server keeps running)' -ForegroundColor Gray
Write-Host ''
Write-Host '──────────────────────────────────────────────────────' -ForegroundColor DarkGray
Write-Host ''

# Wait for log file
`$attempts = 0
while (-not (Test-Path E:\Sminventory\.runtime\server.log) -and `$attempts -lt 10) {
    Write-Host 'Waiting for logs...' -ForegroundColor Gray
    Start-Sleep -Seconds 1
    `$attempts++
}

if (Test-Path E:\Sminventory\.runtime\server.log) {
    Get-Content E:\Sminventory\.runtime\server.log -Wait -Tail 50
} else {
    Write-Host 'Log file not found' -ForegroundColor Red
    Read-Host 'Press Enter to exit'
}
"@

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Sminventory is running!" -ForegroundColor Green
Write-Host "URL: http://localhost:6660" -ForegroundColor White
Write-Host ""
Write-Host "To stop: run stop-sminventory.ps1" -ForegroundColor Gray
Write-Host "========================================" -ForegroundColor Cyan
