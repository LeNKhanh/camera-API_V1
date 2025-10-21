# Quick Test - Delete old camera and re-register with new config

Write-Host "`n=== Re-registering Camera with Fixed Config ===" -ForegroundColor Cyan

$pathName = "camera_49e77c80"
$cameraSource = "rtsp://aidev:aidev123@192.168.1.66:554/cam/realmonitor?channel=2&subtype=0"

Write-Host "`n[1] Deleting old camera path from MediaMTX..." -ForegroundColor Yellow
try {
    Invoke-RestMethod -Uri "http://localhost:9997/v3/config/paths/remove/$pathName" -Method POST -ErrorAction SilentlyContinue | Out-Null
    Write-Host "  OK - Old path removed" -ForegroundColor Green
} catch {
    Write-Host "  INFO - Path did not exist or already removed" -ForegroundColor Gray
}

Write-Host "`n[2] Registering camera with new config..." -ForegroundColor Yellow
$config = @{
    source = $cameraSource
    sourceProtocol = "automatic"
} | ConvertTo-Json

try {
    Invoke-RestMethod -Uri "http://localhost:9997/v3/config/paths/add/$pathName" `
        -Method POST `
        -ContentType "application/json" `
        -Body $config | Out-Null
    Write-Host "  OK - Camera registered!" -ForegroundColor Green
} catch {
    Write-Host "  ERROR - Failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host "`n[3] Verifying camera..." -ForegroundColor Yellow
try {
    $pathInfo = Invoke-RestMethod -Uri "http://localhost:9997/v3/config/paths/get/$pathName" -Method GET
    Write-Host "  OK - Camera verified in MediaMTX" -ForegroundColor Green
    Write-Host "     Source: $($pathInfo.source)" -ForegroundColor Gray
    Write-Host "     Protocol: $($pathInfo.sourceProtocol)" -ForegroundColor Gray
} catch {
    Write-Host "  ERROR - Verification failed" -ForegroundColor Red
    exit 1
}

Write-Host "`n[4] Testing VLC with TRAILING SLASH..." -ForegroundColor Yellow
$rtspUrl = "rtsp://localhost:8554/$pathName/"
Write-Host "  URL: $rtspUrl" -ForegroundColor Cyan
Write-Host "  Note: Trailing slash is REQUIRED" -ForegroundColor Gray

Start-Sleep -Seconds 2
& "C:\Program Files\VideoLAN\VLC\vlc.exe" $rtspUrl

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  VLC Launched!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "If stream works:" -ForegroundColor Yellow
Write-Host "  Solution 1 is working!" -ForegroundColor Green
Write-Host "  Camera auto-registered via API" -ForegroundColor Green
Write-Host "  MediaMTX pulling stream directly" -ForegroundColor Green
Write-Host ""
Write-Host "If stream does not work:" -ForegroundColor Yellow
Write-Host "  - Check camera is online: 192.168.1.66" -ForegroundColor Gray
Write-Host "  - Check MediaMTX logs in its window" -ForegroundColor Gray
Write-Host "  - Verify camera credentials are correct" -ForegroundColor Gray
Write-Host ""
