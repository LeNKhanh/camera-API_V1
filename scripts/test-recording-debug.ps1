# Test Recording Debug - Kiểm tra FFmpeg recording với camera thật
# Camera ID: 49e77c80-af6e-4ac6-b0ea-b4f018dacac7

$cameraId = "49e77c80-af6e-4ac6-b0ea-b4f018dacac7"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "TEST RECORDING DEBUG" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Get camera info from database
Write-Host "[1/5] Getting camera info from database..." -ForegroundColor Yellow
$cameraQuery = "SELECT id, name, ip_address, rtsp_url, rtsp_port, username, password FROM cameras WHERE id = '$cameraId';"
$cameraInfo = psql -U postgres -d Camera_api -t -A -F "|" -c $cameraQuery

if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($cameraInfo)) {
    Write-Host "ERROR: Camera not found in database!" -ForegroundColor Red
    exit 1
}

$fields = $cameraInfo.Split("|")
$id = $fields[0]
$name = $fields[1]
$ip = $fields[2]
$rtspUrl = $fields[3]
$rtspPort = $fields[4]
$username = $fields[5]
$password = $fields[6]

Write-Host "Camera Found:" -ForegroundColor Green
Write-Host "  ID: $id"
Write-Host "  Name: $name"
Write-Host "  IP: $ip"
Write-Host "  RTSP Port: $rtspPort"
Write-Host "  RTSP URL: $rtspUrl"
Write-Host "  Username: $username"
Write-Host "  Password: ****"
Write-Host ""

# 2. Build RTSP URL
Write-Host "[2/5] Building RTSP URL..." -ForegroundColor Yellow
if ([string]::IsNullOrWhiteSpace($rtspUrl)) {
    $finalRtspUrl = "rtsp://${username}:${password}@${ip}:${rtspPort}/cam/realmonitor?channel=1&subtype=0"
    Write-Host "  Using auto-generated URL (Dahua format)" -ForegroundColor Yellow
} else {
    $finalRtspUrl = $rtspUrl
    Write-Host "  Using custom RTSP URL from database" -ForegroundColor Green
}
Write-Host "  RTSP URL: $finalRtspUrl"
Write-Host ""

# 3. Test RTSP connectivity with FFmpeg (probe only)
Write-Host "[3/5] Testing RTSP connectivity (FFmpeg probe)..." -ForegroundColor Yellow
$probeOutput = ffmpeg -hide_banner -rtsp_transport tcp -timeout 5000000 -i "$finalRtspUrl" -t 1 -f null - 2>&1
$probeExitCode = $LASTEXITCODE

if ($probeExitCode -eq 0) {
    Write-Host "  SUCCESS: RTSP stream is accessible!" -ForegroundColor Green
} else {
    Write-Host "  ERROR: Cannot connect to RTSP stream!" -ForegroundColor Red
    Write-Host "  FFmpeg output:" -ForegroundColor Red
    Write-Host $probeOutput -ForegroundColor Gray
    Write-Host ""
    Write-Host "Common issues:" -ForegroundColor Yellow
    Write-Host "  - Check camera RTSP URL format"
    Write-Host "  - Verify username/password are correct"
    Write-Host "  - Ensure camera allows RTSP connections"
    Write-Host "  - Check firewall/network connectivity"
    exit 1
}
Write-Host ""

# 4. Start a test recording (5 seconds)
Write-Host "[4/5] Starting test recording (5 seconds)..." -ForegroundColor Yellow
$testFile = "$env:TEMP\test-recording-$cameraId.mp4"
if (Test-Path $testFile) {
    Remove-Item $testFile -Force
}

$recordArgs = @(
    "-hide_banner",
    "-rtsp_transport", "tcp",
    "-timeout", "10000000",
    "-i", "$finalRtspUrl",
    "-t", "5",
    "-c", "copy",
    "-fflags", "nobuffer",
    "-analyzeduration", "1000000",
    "-probesize", "500000",
    "$testFile"
)

Write-Host "  FFmpeg command:" -ForegroundColor Cyan
Write-Host "  ffmpeg $($recordArgs -join ' ')" -ForegroundColor Gray
Write-Host ""
Write-Host "  Recording... (please wait 5 seconds)" -ForegroundColor Yellow

$recordOutput = ffmpeg @recordArgs 2>&1
$recordExitCode = $LASTEXITCODE

if ($recordExitCode -eq 0 -and (Test-Path $testFile)) {
    $fileSize = (Get-Item $testFile).Length
    Write-Host "  SUCCESS: Recording completed!" -ForegroundColor Green
    Write-Host "  File: $testFile"
    Write-Host "  Size: $([math]::Round($fileSize / 1KB, 2)) KB"
} else {
    Write-Host "  ERROR: Recording failed!" -ForegroundColor Red
    Write-Host "  FFmpeg output:" -ForegroundColor Red
    Write-Host $recordOutput -ForegroundColor Gray
    exit 1
}
Write-Host ""

# 5. Check recent recordings from database
Write-Host "[5/5] Checking recent recordings from database..." -ForegroundColor Yellow
$recordingsQuery = @"
SELECT 
    id, 
    status, 
    LEFT(error_message, 50) as error_preview,
    strategy,
    duration_sec,
    started_at,
    ended_at
FROM recordings 
WHERE camera_id = '$cameraId' 
ORDER BY created_at DESC 
LIMIT 3;
"@

Write-Host "Recent recordings:" -ForegroundColor Cyan
psql -U postgres -d Camera_api -c $recordingsQuery

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "DIAGNOSIS COMPLETE" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "If FFmpeg test succeeded but API recordings fail:" -ForegroundColor Yellow
Write-Host "  1. Check error_message in database (query above)" -ForegroundColor Yellow
Write-Host "  2. Enable DEBUG_RECORDING=1 in .env" -ForegroundColor Yellow
Write-Host "  3. Check server logs when starting recording" -ForegroundColor Yellow
Write-Host "  4. Verify camera RTSP URL in database matches working URL" -ForegroundColor Yellow
