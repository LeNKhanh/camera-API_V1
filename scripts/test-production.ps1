# Production Testing Script
# Test MediaMTX and Camera API in production environment

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "MediaMTX Production Test" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# Test 1: Check if ports are open
Write-Host "[1] Testing Firewall Ports..." -ForegroundColor Yellow
$ports = @(8554, 8888, 8889)
foreach ($port in $ports) {
    Write-Host "  Testing port $port..." -NoNewline
    $result = Test-NetConnection -ComputerName "proxy-camera.teknix.services" -Port $port -WarningAction SilentlyContinue
    if ($result.TcpTestSucceeded) {
        Write-Host " OK" -ForegroundColor Green
    } else {
        Write-Host " FAILED" -ForegroundColor Red
    }
}
Write-Host ""

# Test 2: Check MediaMTX API (from server side)
Write-Host "[2] Testing MediaMTX API..." -ForegroundColor Yellow
Write-Host "  Note: API is localhost-only, test from server:" -ForegroundColor Gray
Write-Host "  ssh user@proxy-camera.teknix.services 'curl http://localhost:9997/v3/paths/list'" -ForegroundColor Gray
Write-Host ""

# Test 3: Test Camera API proxy endpoint
Write-Host "[3] Testing Camera API Proxy Endpoint..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "https://camera-api.teknix.services/streams/49e77c80-af6e-4ac6-b0ea-b4f018dacac7/proxy" -UseBasicParsing
    Write-Host "  Status: $($response.StatusCode)" -ForegroundColor Green
    $json = $response.Content | ConvertFrom-Json
    Write-Host "  Registered: $($json.registered)" -ForegroundColor Green
    Write-Host "  RTSP URL: $($json.protocols.rtsp)" -ForegroundColor Cyan
    Write-Host "  HLS URL: $($json.protocols.hls)" -ForegroundColor Cyan
    Write-Host "  HLS Web Player: $($json.protocols.hlsWebPlayer)" -ForegroundColor Cyan
    Write-Host "  WebRTC URL: $($json.protocols.webrtc)" -ForegroundColor Cyan
} catch {
    Write-Host "  FAILED: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# Test 4: Check HLS manifest availability
Write-Host "[4] Testing HLS Manifest..." -ForegroundColor Yellow
$hlsUrl = "https://proxy-camera.teknix.services:8888/camera_49e77c80/index.m3u8"
try {
    $response = Invoke-WebRequest -Uri $hlsUrl -UseBasicParsing
    Write-Host "  Status: $($response.StatusCode)" -ForegroundColor Green
    $lines = $response.Content -split "`n"
    Write-Host "  First line: $($lines[0])" -ForegroundColor Cyan
    Write-Host "  Content length: $($response.Content.Length) bytes" -ForegroundColor Cyan
} catch {
    Write-Host "  FAILED: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "  Trying HTTP (port 8888)..." -ForegroundColor Yellow
    try {
        $httpUrl = "http://proxy-camera.teknix.services:8888/camera_49e77c80/index.m3u8"
        $response = Invoke-WebRequest -Uri $httpUrl -UseBasicParsing
        Write-Host "  HTTP Status: $($response.StatusCode)" -ForegroundColor Green
    } catch {
        Write-Host "  HTTP also failed: $($_.Exception.Message)" -ForegroundColor Red
    }
}
Write-Host ""

# Test 5: Open HLS Web Player
Write-Host "[5] Opening HLS Web Player..." -ForegroundColor Yellow
Write-Host "  Browser will open to: https://proxy-camera.teknix.services:8888/camera_49e77c80/" -ForegroundColor Cyan
Write-Host "  (If HTTPS fails, try: http://proxy-camera.teknix.services:8888/camera_49e77c80/)" -ForegroundColor Gray
Start-Sleep -Seconds 2
Start-Process "https://proxy-camera.teknik.services:8888/camera_49e77c80/"
Write-Host ""

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "Test Complete!" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "1. If ports are CLOSED, run on server:" -ForegroundColor White
Write-Host "   sudo ufw allow 8554/tcp && sudo ufw allow 8888/tcp && sudo ufw allow 8889/tcp" -ForegroundColor Gray
Write-Host "2. If MediaMTX not running, run on server:" -ForegroundColor White
Write-Host "   sudo systemctl start mediamtx && sudo systemctl status mediamtx" -ForegroundColor Gray
Write-Host "3. Check MediaMTX logs:" -ForegroundColor White
Write-Host "   sudo journalctl -u mediamtx -f" -ForegroundColor Gray
Write-Host ""
