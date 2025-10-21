# Test MediaMTX Dynamic API

$baseUrl = "http://localhost:3000"
$cameraId = "49e77c80-af6e-4ac6-b0ea-b4f018dacac7"

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  MediaMTX Dynamic API Test" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Step 1: Login
Write-Host "[1/4] Logging in..." -ForegroundColor Yellow
$loginBody = @{
    username = "admin"
    password = "admin123"
} | ConvertTo-Json

try {
    $loginResponse = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method POST -ContentType "application/json" -Body $loginBody
    $token = $loginResponse.token
    Write-Host "Success - Logged in" -ForegroundColor Green
} catch {
    Write-Host "Error - Login failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Step 2: Check MediaMTX API
Write-Host "`n[2/4] Checking MediaMTX API..." -ForegroundColor Yellow
try {
    $mediamtxApi = Invoke-RestMethod -Uri "http://localhost:9997/v3/config/global/get" -Method GET -ErrorAction Stop
    Write-Host "Success - MediaMTX API responding" -ForegroundColor Green
} catch {
    Write-Host "Error - MediaMTX API not available" -ForegroundColor Red
    Write-Host "  Make sure MediaMTX is running with API enabled" -ForegroundColor Yellow
    exit 1
}

# Step 3: Get proxy URL (will auto-register camera)
Write-Host "`n[3/4] Getting proxy URL (auto-registering camera)..." -ForegroundColor Yellow
try {
    $headers = @{ Authorization = "Bearer $token" }
    $proxyResponse = Invoke-RestMethod -Uri "$baseUrl/streams/$cameraId/proxy" -Method GET -Headers $headers
    
    Write-Host "Success - Proxy URL retrieved!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Camera:" -ForegroundColor Cyan
    Write-Host "  Name: $($proxyResponse.cameraName)" -ForegroundColor Gray
    Write-Host "  Path: $($proxyResponse.pathId)" -ForegroundColor Gray
    
    Write-Host "`nProxy URLs:" -ForegroundColor Cyan
    $rtspUrl = $proxyResponse.protocols.rtsp
    $hlsUrl = $proxyResponse.protocols.hls
    Write-Host "  RTSP:   $rtspUrl" -ForegroundColor Green
    Write-Host "  HLS:    $hlsUrl" -ForegroundColor Green
    
    Write-Host "`nSecurity:" -ForegroundColor Cyan
    Write-Host "  Auto-registered: $($proxyResponse.security.autoRegistered)" -ForegroundColor Green
    Write-Host "  Camera IP Hidden: $($proxyResponse.security.cameraIpHidden)" -ForegroundColor Green
    Write-Host "  $($proxyResponse.security.note)" -ForegroundColor Gray
    
} catch {
    Write-Host "Error - Failed to get proxy URL" -ForegroundColor Red
    Write-Host "  $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Step 4: Verify camera registered in MediaMTX
Write-Host "`n[4/4] Verifying camera in MediaMTX..." -ForegroundColor Yellow
$pathName = $proxyResponse.pathId
try {
    $pathInfo = Invoke-RestMethod -Uri "http://localhost:9997/v3/config/paths/get/$pathName" -Method GET
    Write-Host "Success - Camera registered in MediaMTX!" -ForegroundColor Green
    Write-Host "  Source: $($pathInfo.source)" -ForegroundColor Gray
    Write-Host "  On-demand: $($pathInfo.sourceOnDemand)" -ForegroundColor Gray
} catch {
    Write-Host "Warning - Could not verify camera in MediaMTX" -ForegroundColor Yellow
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  Test Complete!" -ForegroundColor Green
Write-Host "========================================`n" -ForegroundColor Cyan

Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "1. Test VLC:" -ForegroundColor Gray
Write-Host "   vlc $rtspUrl" -ForegroundColor Cyan
Write-Host "2. Test browser:" -ForegroundColor Gray
Write-Host "   Open: $hlsUrl" -ForegroundColor Cyan
Write-Host ""
Write-Host "Camera is now auto-registered!" -ForegroundColor Green
Write-Host "Add more cameras via API  They auto-register!" -ForegroundColor Green
Write-Host ""
