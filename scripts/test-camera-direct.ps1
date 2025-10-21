# Test Camera Connection Directly

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  Camera Connection Test" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Camera info
$cameraIp = "192.168.1.66"
$cameraPort = 554
$username = "aidev"
$password = "aidev123"
$rtspPath = "/cam/realmonitor?channel=2&subtype=0"

Write-Host "[1/4] Testing network connectivity to camera..." -ForegroundColor Yellow
$ping = Test-Connection -ComputerName $cameraIp -Count 2 -ErrorAction SilentlyContinue

if ($ping) {
    Write-Host "Success - Camera is reachable at $cameraIp" -ForegroundColor Green
} else {
    Write-Host "Error - Cannot reach camera at $cameraIp" -ForegroundColor Red
    Write-Host "  Please check:" -ForegroundColor Yellow
    Write-Host "  1. Camera is powered on" -ForegroundColor Gray
    Write-Host "  2. Camera is on same network" -ForegroundColor Gray
    Write-Host "  3. IP address is correct: $cameraIp" -ForegroundColor Gray
    exit 1
}

Write-Host "`n[2/4] Testing RTSP port $cameraPort..." -ForegroundColor Yellow
$portTest = Test-NetConnection -ComputerName $cameraIp -Port $cameraPort -WarningAction SilentlyContinue

if ($portTest.TcpTestSucceeded) {
    Write-Host "Success - RTSP port $cameraPort is open" -ForegroundColor Green
} else {
    Write-Host "Error - RTSP port $cameraPort is closed or blocked" -ForegroundColor Red
    exit 1
}

Write-Host "`n[3/4] Building direct RTSP URL..." -ForegroundColor Yellow
$directUrl = "rtsp://${username}:${password}@${cameraIp}:${cameraPort}${rtspPath}"
Write-Host "  URL: $directUrl" -ForegroundColor Cyan

Write-Host "`n[4/4] Testing with FFmpeg (if available)..." -ForegroundColor Yellow
$ffmpegPath = Get-Command ffmpeg -ErrorAction SilentlyContinue

if ($ffmpegPath) {
    Write-Host "FFmpeg found. Testing camera stream..." -ForegroundColor Green
    $testFile = "test_camera_frame.jpg"
    
    # Test camera with FFmpeg
    $ffmpegArgs = "-rtsp_transport tcp -i `"$directUrl`" -frames:v 1 -y $testFile"
    Write-Host "  Running: ffmpeg $ffmpegArgs" -ForegroundColor Gray
    
    $process = Start-Process ffmpeg -ArgumentList $ffmpegArgs -NoNewWindow -Wait -PassThru
    
    if ($process.ExitCode -eq 0 -and (Test-Path $testFile)) {
        Write-Host "Success - Camera stream is working!" -ForegroundColor Green
        Write-Host "  Test frame saved: $testFile" -ForegroundColor Gray
        
        # Get file size
        $fileSize = (Get-Item $testFile).Length
        Write-Host "  Frame size: $fileSize bytes" -ForegroundColor Gray
        
        if ($fileSize -gt 1000) {
            Write-Host "`nCamera connection is GOOD!" -ForegroundColor Green
            Write-Host "MediaMTX should be able to proxy this camera." -ForegroundColor Green
        } else {
            Write-Host "`nWarning - Frame size too small. Check camera settings." -ForegroundColor Yellow
        }
    } else {
        Write-Host "Error - Cannot get stream from camera" -ForegroundColor Red
        Write-Host "  Possible issues:" -ForegroundColor Yellow
        Write-Host "  1. Wrong username/password" -ForegroundColor Gray
        Write-Host "  2. Wrong RTSP path" -ForegroundColor Gray
        Write-Host "  3. Camera RTSP disabled" -ForegroundColor Gray
    }
} else {
    Write-Host "FFmpeg not found. Skipping stream test." -ForegroundColor Yellow
    Write-Host "  Install FFmpeg to test camera stream" -ForegroundColor Gray
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  Camera Info Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "IP:       $cameraIp" -ForegroundColor Gray
Write-Host "Port:     $cameraPort" -ForegroundColor Gray
Write-Host "Username: $username" -ForegroundColor Gray
Write-Host "Password: $password" -ForegroundColor Gray
Write-Host "Path:     $rtspPath" -ForegroundColor Gray
Write-Host "`nDirect URL: $directUrl" -ForegroundColor Yellow

Write-Host "`nTest in VLC directly:" -ForegroundColor Cyan
Write-Host "1. Open VLC" -ForegroundColor Gray
Write-Host "2. Ctrl+N" -ForegroundColor Gray
Write-Host "3. Paste: $directUrl" -ForegroundColor Gray
Write-Host "4. Click Play" -ForegroundColor Gray
Write-Host ""
