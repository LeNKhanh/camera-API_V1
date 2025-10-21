# Demo: Add Multiple Dahua Cameras

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  Demo: Add New Camera to MediaMTX" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Example: Add a second Dahua camera
Write-Host "Example: Adding camera 'abcd1234-5678-90ab-cdef-1234567890ab'" -ForegroundColor Yellow
Write-Host ""

# Simulate adding new camera
$newCameraId = "abcd1234-5678-90ab-cdef-1234567890ab"
$pathId = $newCameraId.Substring(0, 8)

Write-Host "Step 1: Generate camera configuration" -ForegroundColor Green
$config = @"

  # Camera $newCameraId (Office Entrance)
  camera_${pathId}:
    source: rtsp://admin:admin123@192.168.1.67:554/cam/realmonitor?channel=1&subtype=0
    sourceOnDemand: yes
    sourceOnDemandStartTimeout: 10s
    sourceOnDemandCloseAfter: 10s
"@

Write-Host $config -ForegroundColor Cyan

Write-Host "`nStep 2: Add to mediamtx.yml" -ForegroundColor Green
Write-Host "  Location: D:\camera_Api\Camera-api\mediamtx\mediamtx.yml" -ForegroundColor Gray
Write-Host "  Section: Under 'paths:'" -ForegroundColor Gray

Write-Host "`nStep 3: Restart MediaMTX" -ForegroundColor Green
Write-Host "  Get-Process -Name mediamtx | Stop-Process -Force" -ForegroundColor Gray

Write-Host "`nStep 4: Test with VLC" -ForegroundColor Green
Write-Host "  vlc rtsp://localhost:8554/camera_$pathId" -ForegroundColor Cyan

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  Current MediaMTX Configuration" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Show current cameras
Write-Host "Cameras currently configured:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Camera: camera_49e77c80" -ForegroundColor Green
Write-Host "   IP: 192.168.1.66 (Channel 2)" -ForegroundColor Gray
Write-Host "   URL: rtsp://localhost:8554/camera_49e77c80" -ForegroundColor Cyan
Write-Host "   Status: ✅ Working" -ForegroundColor Green
Write-Host ""

Write-Host "To add more cameras:" -ForegroundColor Yellow
Write-Host "1. Edit mediamtx/mediamtx.yml" -ForegroundColor Gray
Write-Host "2. Add camera block under 'paths:'" -ForegroundColor Gray
Write-Host "3. Restart MediaMTX" -ForegroundColor Gray
Write-Host ""

Write-Host "Helper script available:" -ForegroundColor Yellow
Write-Host ".\scripts\add-camera-to-mediamtx.ps1 -CameraId '<id>' -CameraIP '<ip>' -Username '<user>' -Password '<pass>' -Channel <num>" -ForegroundColor Cyan
Write-Host ""
