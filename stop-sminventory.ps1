# Sminventory Stop Script - Windows PowerShell Version

Write-Host "Stopping Sminventory Server..." -ForegroundColor Cyan
Write-Host ""

# Kill the Next.js server via WSL
$null = wsl pkill -f "next dev -p 6660" 2>&1

# Wait a moment
Start-Sleep -Seconds 2

# Check if it's stopped
$portTest = Test-NetConnection -ComputerName localhost -Port 6660 -WarningAction SilentlyContinue -ErrorAction SilentlyContinue -InformationLevel Quiet

if (-not $portTest) {
    Write-Host "Server stopped successfully!" -ForegroundColor Green

    # Clean up runtime files
    if (Test-Path "E:\Sminventory\.runtime\server.pid") {
        Remove-Item "E:\Sminventory\.runtime\server.pid" -Force
    }
} else {
    Write-Host "Warning: Port 6660 may still be in use" -ForegroundColor Yellow
    Write-Host "You may need to close the WSL window manually" -ForegroundColor Gray
}

Write-Host ""
Write-Host "Done!" -ForegroundColor Green
