# Test Stream RTSP URL với VLC
# Script này sẽ lấy RTSP URL từ camera và mở trong VLC

param(
    [string]$CameraId = "49e77c80-af6e-4ac6-b0ea-b4f018dacac7"  # Default: camera thật của bạn
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "TEST RTSP STREAM WITH VLC" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Login
Write-Host "[1/4] Logging in..." -ForegroundColor Yellow
try {
    $loginBody = @{
        username = "admin"
        password = "admin123"
    } | ConvertTo-Json

    $login = Invoke-RestMethod -Method Post `
        -Uri "http://localhost:3000/auth/login" `
        -ContentType "application/json" `
        -Body $loginBody

    $token = $login.access_token
    Write-Host "✅ Login successful!" -ForegroundColor Green
    Write-Host ""
} catch {
    Write-Host "❌ Login failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Step 2: Get RTSP URL
Write-Host "[2/4] Getting RTSP URL for camera..." -ForegroundColor Yellow
Write-Host "   Camera ID: $CameraId" -ForegroundColor Gray
Write-Host ""

try {
    $streamInfo = Invoke-RestMethod -Method Get `
        -Uri "http://localhost:3000/streams/$CameraId/rtsp" `
        -Headers @{ Authorization = "Bearer $token" }

    $rtspUrl = $streamInfo.rtspUrl
    $cameraName = $streamInfo.cameraName

    Write-Host "✅ RTSP URL retrieved!" -ForegroundColor Green
    Write-Host "   Camera: $cameraName" -ForegroundColor Gray
    Write-Host ""
} catch {
    Write-Host "❌ Failed to get RTSP URL: $($_.Exception.Message)" -ForegroundColor Red
    
    if ($_.Exception.Response.StatusCode -eq 404) {
        Write-Host "   Camera not found. Available cameras:" -ForegroundColor Yellow
        try {
            $cameras = Invoke-RestMethod -Method Get `
                -Uri "http://localhost:3000/cameras" `
                -Headers @{ Authorization = "Bearer $token" }
            
            foreach ($cam in $cameras) {
                Write-Host "   - $($cam.id) : $($cam.name)" -ForegroundColor Cyan
            }
        } catch {
            Write-Host "   Failed to list cameras" -ForegroundColor Red
        }
    }
    
    exit 1
}

# Step 3: Display RTSP URL and Instructions
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "📺 RTSP STREAM URL" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Camera: $cameraName" -ForegroundColor White
Write-Host "RTSP URL:" -ForegroundColor Yellow
Write-Host $rtspUrl -ForegroundColor Green
Write-Host ""

# Step 4: Try to open in VLC
Write-Host "[3/4] Opening in VLC..." -ForegroundColor Yellow

# Common VLC installation paths
$vlcPaths = @(
    "${env:ProgramFiles}\VideoLAN\VLC\vlc.exe",
    "${env:ProgramFiles(x86)}\VideoLAN\VLC\vlc.exe",
    "$env:LOCALAPPDATA\Programs\VLC\vlc.exe"
)

$vlcPath = $null
foreach ($path in $vlcPaths) {
    if (Test-Path $path) {
        $vlcPath = $path
        break
    }
}

if ($vlcPath) {
    Write-Host "✅ VLC found: $vlcPath" -ForegroundColor Green
    Write-Host "   Opening stream..." -ForegroundColor Yellow
    Write-Host ""
    
    try {
        # Start VLC with RTSP URL
        Start-Process -FilePath $vlcPath -ArgumentList $rtspUrl
        
        Write-Host "✅ VLC launched successfully!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Expected behavior:" -ForegroundColor Yellow
        Write-Host "  - VLC window should open" -ForegroundColor White
        Write-Host "  - Video should start playing within 5-10 seconds" -ForegroundColor White
        Write-Host "  - If buffering, wait a moment" -ForegroundColor White
        Write-Host ""
        
    } catch {
        Write-Host "❌ Failed to launch VLC: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "   Try opening VLC manually and paste URL" -ForegroundColor Yellow
    }
    
} else {
    Write-Host "⚠️ VLC not found on this system" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "📋 Manual Steps:" -ForegroundColor Cyan
    Write-Host "  1. Install VLC from: https://www.videolan.org/vlc/" -ForegroundColor White
    Write-Host "  2. Open VLC" -ForegroundColor White
    Write-Host "  3. Press Ctrl+N (Open Network Stream)" -ForegroundColor White
    Write-Host "  4. Paste this URL:" -ForegroundColor White
    Write-Host "     $rtspUrl" -ForegroundColor Green
    Write-Host "  5. Click Play" -ForegroundColor White
    Write-Host ""
}

# Step 5: Alternative test with FFplay
Write-Host "[4/4] Alternative: Test with FFplay..." -ForegroundColor Yellow

# Check if FFmpeg/FFplay is installed
$ffplayPath = Get-Command ffplay -ErrorAction SilentlyContinue

if ($ffplayPath) {
    Write-Host "✅ FFplay found: $($ffplayPath.Source)" -ForegroundColor Green
    Write-Host ""
    Write-Host "To test with FFplay, run:" -ForegroundColor Cyan
    Write-Host "ffplay -rtsp_transport tcp `"$rtspUrl`"" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host "⚠️ FFplay not found (comes with FFmpeg)" -ForegroundColor Yellow
    Write-Host "   Install FFmpeg from: https://ffmpeg.org/download.html" -ForegroundColor Gray
    Write-Host ""
}

# Summary
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "📊 SUMMARY" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Camera ID: $CameraId" -ForegroundColor White
Write-Host "Camera Name: $cameraName" -ForegroundColor White
Write-Host "RTSP URL: $rtspUrl" -ForegroundColor Green
Write-Host ""

if ($vlcPath) {
    Write-Host "Status: ✅ VLC launched" -ForegroundColor Green
} else {
    Write-Host "Status: ⚠️ VLC not found - use manual method" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "🔗 API Response (Full):" -ForegroundColor Cyan
$streamInfo | ConvertTo-Json -Depth 10 | Write-Host -ForegroundColor Gray
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✅ Test completed!" -ForegroundColor Green
Write-Host ""
Write-Host "💡 Tips:" -ForegroundColor Yellow
Write-Host "   - If video stutters, check network connection" -ForegroundColor White
Write-Host "   - If no video, verify camera IP and credentials" -ForegroundColor White
Write-Host "   - Use VLC's Tools → Messages (Ctrl+M) to debug" -ForegroundColor White
Write-Host "   - Try different subtype: change subtype=0 to subtype=1" -ForegroundColor White
Write-Host ""
