# PowerShell script to find and kill process using port 3001

Write-Host "Checking for processes using port 3001..." -ForegroundColor Yellow

$connections = Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue

if ($connections) {
    Write-Host "Found processes using port 3001:" -ForegroundColor Red
    $connections | ForEach-Object {
        $process = Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue
        if ($process) {
            Write-Host "  PID: $($_.OwningProcess) - $($process.ProcessName)" -ForegroundColor Yellow
        }
    }
    
    $pids = $connections | Select-Object -ExpandProperty OwningProcess -Unique
    Write-Host "`nKilling processes..." -ForegroundColor Yellow
    
    foreach ($pid in $pids) {
        try {
            Stop-Process -Id $pid -Force -ErrorAction Stop
            Write-Host "  ✓ Killed process $pid" -ForegroundColor Green
        } catch {
            Write-Host "  ✗ Could not kill process $pid : $_" -ForegroundColor Red
        }
    }
    
    Write-Host "`nPort 3001 should now be free. Try running 'npm run dev:all' again." -ForegroundColor Green
} else {
    Write-Host "No processes found using port 3001. Port should be available." -ForegroundColor Green
}

