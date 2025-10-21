# Quick test - Call API directly with curl
$cameraId = "49e77c80-af6e-4ac6-b0ea-b4f018dacac7"

Write-Host "`n=== Quick Dynamic API Test ===" -ForegroundColor Cyan

# 1. Login
Write-Host "`n[1] Logging in..." -ForegroundColor Yellow
$loginJson = '{"username":"admin","password":"admin123"}'
$loginResponse = curl.exe -s -X POST "http://localhost:3000/auth/login" `
    -H "Content-Type: application/json" `
    -d $loginJson | ConvertFrom-Json

if ($loginResponse.token) {
    Write-Host "  Success!" -ForegroundColor Green
    $token = $loginResponse.token
} else {
    Write-Host "  Failed! Is API running?" -ForegroundColor Red
    Write-Host "  Start API: npm run start:dev" -ForegroundColor Yellow
    exit 1
}

# 2. Get proxy URL (will auto-register camera)
Write-Host "`n[2] Getting proxy URL (auto-registering camera)..." -ForegroundColor Yellow
$proxyResponse = curl.exe -s -X GET "http://localhost:3000/streams/$cameraId/proxy" `
    -H "Authorization: Bearer $token" | ConvertFrom-Json

if ($proxyResponse.protocols) {
    Write-Host "  Success!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Camera: $($proxyResponse.cameraName)" -ForegroundColor Cyan
    Write-Host "Path:   $($proxyResponse.pathId)" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "RTSP URL:" -ForegroundColor Yellow
    Write-Host "  $($proxyResponse.protocols.rtsp)" -ForegroundColor Green
    Write-Host ""
    Write-Host "Auto-registered: $($proxyResponse.security.autoRegistered)" -ForegroundColor Green
    $rtspUrl = $proxyResponse.protocols.rtsp
} else {
    Write-Host "  Failed!" -ForegroundColor Red
    Write-Host $proxyResponse
    exit 1
}

# 3. Verify in MediaMTX
Write-Host "`n[3] Verifying camera in MediaMTX..." -ForegroundColor Yellow
$pathName = $proxyResponse.pathId
try {
    $mediamtxCheck = curl.exe -s "http://localhost:9997/v3/config/paths/get/$pathName" | ConvertFrom-Json
    Write-Host "  Success - Camera registered in MediaMTX!" -ForegroundColor Green
    Write-Host "  Source: $($mediamtxCheck.source)" -ForegroundColor Gray
} catch {
    Write-Host "  Warning - Could not verify (MediaMTX API might be off)" -ForegroundColor Yellow
}

Write-Host "`n=== Test Complete! ===" -ForegroundColor Green
Write-Host ""
Write-Host "Next: Test VLC" -ForegroundColor Yellow
Write-Host "  vlc `"$rtspUrl`"" -ForegroundColor Cyan
Write-Host ""
Write-Host "Note: RTSP URL now has trailing slash (required by MediaMTX)" -ForegroundColor Gray
Write-Host ""
