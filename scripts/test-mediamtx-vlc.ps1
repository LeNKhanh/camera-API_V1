# Quick Test MediaMTX with VLC

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  MediaMTX Proxy - VLC Test" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Check if MediaMTX is running
Write-Host "[1/3] Checking MediaMTX status..." -ForegroundColor Yellow
$mediamtxRunning = Get-Process -Name mediamtx -ErrorAction SilentlyContinue

if ($mediamtxRunning) {
    Write-Host "Success - MediaMTX is running (PID: $($mediamtxRunning.Id))" -ForegroundColor Green
} else {
    Write-Host "Error - MediaMTX is not running!" -ForegroundColor Red
    Write-Host "Please run: cd mediamtx; .\mediamtx.exe mediamtx.yml" -ForegroundColor Yellow
    exit 1
}

# Test RTSP port
Write-Host "`n[2/3] Checking RTSP port 8554..." -ForegroundColor Yellow
$rtspPort = Get-NetTCPConnection -LocalPort 8554 -ErrorAction SilentlyContinue

if ($rtspPort) {
    Write-Host "Success - RTSP port 8554 is listening" -ForegroundColor Green
} else {
    Write-Host "Error - RTSP port 8554 is not open" -ForegroundColor Red
    exit 1
}

# Test HLS port
Write-Host "`n[3/3] Checking HLS port 8888..." -ForegroundColor Yellow
$hlsPort = Get-NetTCPConnection -LocalPort 8888 -ErrorAction SilentlyContinue

if ($hlsPort) {
    Write-Host "Success - HLS port 8888 is listening" -ForegroundColor Green
} else {
    Write-Host "Warning - HLS port 8888 is not open" -ForegroundColor Yellow
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  MediaMTX is Ready!" -ForegroundColor Green
Write-Host "========================================`n" -ForegroundColor Cyan

Write-Host "Test URLs:" -ForegroundColor Cyan
Write-Host "  RTSP (VLC):   rtsp://localhost:8554/camera_49e77c80" -ForegroundColor Green
Write-Host "  HLS (Browser): http://localhost:8888/camera_49e77c80/index.m3u8" -ForegroundColor Green

Write-Host "`nTo test in VLC:" -ForegroundColor Yellow
Write-Host "1. Open VLC Media Player" -ForegroundColor Gray
Write-Host "2. Press Ctrl+N (Open Network Stream)" -ForegroundColor Gray
Write-Host "3. Paste: rtsp://localhost:8554/camera_49e77c80" -ForegroundColor Gray
Write-Host "4. Click Play" -ForegroundColor Gray

Write-Host "`nOpening VLC automatically..." -ForegroundColor Yellow
Start-Sleep -Seconds 2

# Try to open VLC
$vlcPaths = @(
    "C:\Program Files\VideoLAN\VLC\vlc.exe",
    "C:\Program Files (x86)\VideoLAN\VLC\vlc.exe",
    "${env:ProgramFiles}\VideoLAN\VLC\vlc.exe",
    "${env:ProgramFiles(x86)}\VideoLAN\VLC\vlc.exe"
)

$vlcFound = $false
foreach ($path in $vlcPaths) {
    if (Test-Path $path) {
        Write-Host "`nLaunching VLC with proxy URL..." -ForegroundColor Green
        Start-Process $path -ArgumentList "rtsp://localhost:8554/camera_49e77c80"
        $vlcFound = $true
        break
    }
}

if (-not $vlcFound) {
    Write-Host "`nVLC not found. Please install VLC or manually test the URL:" -ForegroundColor Yellow
    Write-Host "rtsp://localhost:8554/camera_49e77c80" -ForegroundColor Cyan
    
    # Copy to clipboard
    Set-Clipboard -Value "rtsp://localhost:8554/camera_49e77c80"
    Write-Host "`nURL copied to clipboard! Paste in VLC." -ForegroundColor Green
}

Write-Host ""
