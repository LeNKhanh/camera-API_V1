# Test MediaMTX Proxy Endpoint

$baseUrl = "http://localhost:3000"
$cameraId = "49e77c80-af6e-4ac6-b0ea-b4f018dacac7"

Write-Host "`n========================================"  -ForegroundColor Cyan
Write-Host "  MediaMTX Proxy Endpoint Test" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Step 1: Login
Write-Host "[1/3] Logging in..." -ForegroundColor Yellow
$loginBody = @{
    username = "admin"
    password = "admin123"
} | ConvertTo-Json

try {
    $loginResponse = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method POST -ContentType "application/json" -Body $loginBody
    
    $token = $loginResponse.token
    Write-Host "Success - Login successful" -ForegroundColor Green
} catch {
    Write-Host "Error - Login failed" -ForegroundColor Red
    exit 1
}

# Step 2: Get Proxy URL
Write-Host "`n[2/3] Getting proxy URL..." -ForegroundColor Yellow
try {
    $headers = @{ Authorization = "Bearer $token" }
    $proxyResponse = Invoke-RestMethod -Uri "$baseUrl/streams/$cameraId/proxy" -Method GET -Headers $headers
    
    Write-Host "Success - Proxy URL retrieved" -ForegroundColor Green
    Write-Host "`nStream URLs:" -ForegroundColor Cyan
    Write-Host "  RTSP:   $($proxyResponse.protocols.rtsp)" -ForegroundColor Green
    Write-Host "  HLS:    $($proxyResponse.protocols.hls)" -ForegroundColor Green
    Write-Host "  WebRTC: $($proxyResponse.protocols.webrtc)" -ForegroundColor Green
    
    Write-Host "`nSecurity:" -ForegroundColor Cyan
    Write-Host "  Camera IP Hidden: $($proxyResponse.security.cameraIpHidden)" -ForegroundColor Green
    Write-Host "  Credentials Protected: $($proxyResponse.security.credentialsProtected)" -ForegroundColor Green
    
} catch {
    Write-Host "Error - Failed" -ForegroundColor Red
    exit 1
}

Write-Host "`n========================================"  -ForegroundColor Cyan
Write-Host "  Test Completed!" -ForegroundColor Green
Write-Host "========================================`n" -ForegroundColor Cyan
