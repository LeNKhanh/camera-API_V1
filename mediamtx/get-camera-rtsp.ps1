# Get Camera RTSP and Proxy to MediaMTX
# This script pulls RTSP stream from camera and pushes to MediaMTX
param(
    [string]$MTX_PATH
)

# Database connection
$dbHost = "localhost"
$dbPort = "5432"
$dbUser = "postgres"
$dbPass = "admin"
$dbName = "Camera_api"

# Extract camera ID from path (camera_XXXXXXXX -> first 8 chars)
$pathId = $MTX_PATH -replace '^camera_', ''

# Query database for camera
$query = @"
SELECT id, name, ip_address, username, password, rtsp_port, channel, rtsp_url
FROM cameras 
WHERE CAST(id AS TEXT) LIKE '$pathId%'
LIMIT 1;
"@

$env:PGPASSWORD = $dbPass
$result = & psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -t -A -F "|" -c $query 2>$null

if (-not $result) {
    Write-Error "[MediaMTX] Camera not found for path: $MTX_PATH"
    exit 1
}

# Parse result
$fields = $result -split '\|'
$cameraId = $fields[0]
$cameraName = $fields[1]
$ip = $fields[2]
$user = $fields[3]
$pass = $fields[4]
$port = if ($fields[5]) { $fields[5] } else { 554 }
$channel = if ($fields[6]) { $fields[6] } else { 1 }
$customRtsp = $fields[7]

# Build RTSP URL
if ($customRtsp -and $customRtsp.Trim() -ne '') {
    $rtspUrl = $customRtsp.Trim()
} else {
    # Dahua format
    $rtspUrl = "rtsp://${user}:${pass}@${ip}:${port}/cam/realmonitor?channel=${channel}&subtype=0"
}

Write-Host "[MediaMTX] Camera: $cameraName ($cameraId)" -ForegroundColor Green
Write-Host "[MediaMTX] Source: $rtspUrl" -ForegroundColor Cyan
Write-Host "[MediaMTX] Pushing to: rtsp://localhost:$env:RTSP_PORT/$MTX_PATH" -ForegroundColor Yellow

# Use FFmpeg to pull from camera and push to MediaMTX
# MediaMTX will receive the stream via RTSP PUBLISH
$ffmpegArgs = @(
    "-rtsp_transport", "tcp",
    "-i", $rtspUrl,
    "-c", "copy",
    "-f", "rtsp",
    "rtsp://localhost:$env:RTSP_PORT/$MTX_PATH"
)

Write-Host "[MediaMTX] Starting FFmpeg proxy..." -ForegroundColor Yellow
& ffmpeg $ffmpegArgs 2>&1 | Out-Null
