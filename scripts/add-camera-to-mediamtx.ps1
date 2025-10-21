# Add Dahua Camera to MediaMTX
# Script to help add new Dahua cameras to MediaMTX config

param(
    [Parameter(Mandatory=$true)]
    [string]$CameraId,
    
    [Parameter(Mandatory=$true)]
    [string]$CameraIP,
    
    [Parameter(Mandatory=$true)]
    [string]$Username,
    
    [Parameter(Mandatory=$true)]
    [string]$Password,
    
    [Parameter(Mandatory=$false)]
    [int]$Channel = 1,
    
    [Parameter(Mandatory=$false)]
    [int]$Port = 554
)

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  Add Dahua Camera to MediaMTX" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Use first 8 characters of camera ID
$pathId = $CameraId.Substring(0, [Math]::Min(8, $CameraId.Length))

# Build RTSP URL (Dahua format)
$rtspUrl = "rtsp://${Username}:${Password}@${CameraIP}:${Port}/cam/realmonitor?channel=${Channel}&subtype=0"

Write-Host "Camera Information:" -ForegroundColor Yellow
Write-Host "  Full ID:    $CameraId" -ForegroundColor Gray
Write-Host "  Path ID:    camera_$pathId" -ForegroundColor Gray
Write-Host "  IP:         $CameraIP" -ForegroundColor Gray
Write-Host "  Channel:    $Channel" -ForegroundColor Gray
Write-Host "  RTSP URL:   $rtspUrl" -ForegroundColor Gray

# Config to add
$config = @"

  # Camera $CameraId
  camera_${pathId}:
    source: $rtspUrl
    sourceOnDemand: yes
    sourceOnDemandStartTimeout: 10s
    sourceOnDemandCloseAfter: 10s
"@

Write-Host "`nConfiguration to add:" -ForegroundColor Yellow
Write-Host $config -ForegroundColor Cyan

Write-Host "`nAdd to mediamtx.yml under 'paths:' section" -ForegroundColor Yellow
Write-Host "Then restart MediaMTX to apply changes." -ForegroundColor Yellow

# Copy config to clipboard
$config | Set-Clipboard
Write-Host "`nConfiguration copied to clipboard!" -ForegroundColor Green

Write-Host "`nProxy URL will be:" -ForegroundColor Yellow
Write-Host "  RTSP:   rtsp://localhost:8554/camera_$pathId" -ForegroundColor Cyan
Write-Host "  HLS:    http://localhost:8888/camera_$pathId/index.m3u8" -ForegroundColor Cyan
Write-Host "  WebRTC: http://localhost:8889/camera_$pathId/whep" -ForegroundColor Cyan
Write-Host ""
