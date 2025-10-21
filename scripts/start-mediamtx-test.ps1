# Start MediaMTX and Test

Write-Host "Starting MediaMTX..." -ForegroundColor Yellow

# Kill any existing MediaMTX
Get-Process -Name mediamtx -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

# Start MediaMTX in background
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "cd D:\camera_Api\Camera-api\mediamtx; Write-Host 'MediaMTX Starting...' -ForegroundColor Green; .\mediamtx.exe mediamtx.yml"
) -WindowStyle Normal

Write-Host "Waiting for MediaMTX to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Check if running
$process = Get-Process -Name mediamtx -ErrorAction SilentlyContinue

if ($process) {
    Write-Host "MediaMTX is running (PID: $($process.Id))" -ForegroundColor Green
    
    Write-Host "`nTesting VLC..." -ForegroundColor Yellow
    Start-Sleep -Seconds 2
    
    # Launch VLC
    $vlcPaths = @(
        "C:\Program Files\VideoLAN\VLC\vlc.exe",
        "C:\Program Files (x86)\VideoLAN\VLC\vlc.exe"
    )
    
    foreach ($path in $vlcPaths) {
        if (Test-Path $path) {
            Write-Host "Launching VLC with proxy URL..." -ForegroundColor Green
            Start-Process $path -ArgumentList "rtsp://localhost:8554/camera_49e77c80"
            break
        }
    }
    
    Write-Host "`nProxy URL: rtsp://localhost:8554/camera_49e77c80" -ForegroundColor Cyan
    Write-Host "If VLC shows stream, MediaMTX proxy is working!" -ForegroundColor Green
} else {
    Write-Host "Error - MediaMTX failed to start" -ForegroundColor Red
}
