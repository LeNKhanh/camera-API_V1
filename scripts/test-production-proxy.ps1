# Test Production Proxy Endpoint
# Usage: .\test-production-proxy.ps1 -Token "YOUR_SSO_TOKEN" -CameraId "be5729fe-ab9a-4175-957a-f24b980bddcc"

param(
    [Parameter(Mandatory=$true)]
    [string]$Token,
    
    [Parameter(Mandatory=$false)]
    [string]$CameraId = "be5729fe-ab9a-4175-957a-f24b980bddcc",
    
    [Parameter(Mandatory=$false)]
    [string]$BaseUrl = "https://watcher-gateway.blocktrend.xyz/api/v1/camera"
)

$ErrorActionPreference = "Continue"

Write-Host "`n=== Production Proxy Endpoint Test ===" -ForegroundColor Cyan
Write-Host "Camera ID: $CameraId" -ForegroundColor Yellow
Write-Host "Base URL: $BaseUrl" -ForegroundColor Yellow

# Test 1: GET /streams/:cameraId/proxy (without protocol param)
Write-Host "`n[Test 1] GET /proxy (no protocol param)..." -ForegroundColor Green
$proxyUrl = "$BaseUrl/streams/$CameraId/proxy"
Write-Host "URL: $proxyUrl" -ForegroundColor Gray

try {
    $response1 = Invoke-WebRequest -Uri $proxyUrl -Headers @{
        "Authorization" = "Bearer $Token"
    } -UseBasicParsing -ErrorAction Stop
    
    Write-Host "SUCCESS: Status $($response1.StatusCode)" -ForegroundColor Green
    Write-Host "Response:" -ForegroundColor Cyan
    $response1.Content | ConvertFrom-Json | ConvertTo-Json -Depth 5
} catch {
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        Write-Host "Status Code: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Red
        Write-Host "Status Description: $($_.Exception.Response.StatusDescription)" -ForegroundColor Red
        
        try {
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            $responseBody = $reader.ReadToEnd()
            Write-Host "Response Body: $responseBody" -ForegroundColor Yellow
        } catch {
            Write-Host "Could not read response body" -ForegroundColor Gray
        }
    }
}

# Test 2: GET /streams/:cameraId/proxy?protocol=HLS (what frontend is calling)
Write-Host "`n[Test 2] GET /proxy?protocol=HLS (what frontend calls)..." -ForegroundColor Green
$proxyUrlWithProtocol = "$BaseUrl/streams/$CameraId/proxy?protocol=HLS"
Write-Host "URL: $proxyUrlWithProtocol" -ForegroundColor Gray

try {
    $response2 = Invoke-WebRequest -Uri $proxyUrlWithProtocol -Headers @{
        "Authorization" = "Bearer $Token"
    } -UseBasicParsing -ErrorAction Stop
    
    Write-Host "SUCCESS: Status $($response2.StatusCode)" -ForegroundColor Green
    Write-Host "Response:" -ForegroundColor Cyan
    $response2.Content | ConvertFrom-Json | ConvertTo-Json -Depth 5
} catch {
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        Write-Host "Status Code: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Red
        Write-Host "Status Description: $($_.Exception.Response.StatusDescription)" -ForegroundColor Red
        
        try {
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            $responseBody = $reader.ReadToEnd()
            Write-Host "Response Body: $responseBody" -ForegroundColor Yellow
        } catch {
            Write-Host "Could not read response body" -ForegroundColor Gray
        }
    }
}

# Test 3: GET /streams/:cameraId/url?protocol=HLS (correct endpoint for protocol param)
Write-Host "`n[Test 3] GET /url?protocol=HLS (correct endpoint)..." -ForegroundColor Green
$urlEndpoint = "$BaseUrl/streams/$CameraId/url?protocol=HLS"
Write-Host "URL: $urlEndpoint" -ForegroundColor Gray

try {
    $response3 = Invoke-WebRequest -Uri $urlEndpoint -Headers @{
        "Authorization" = "Bearer $Token"
    } -UseBasicParsing -ErrorAction Stop
    
    Write-Host "SUCCESS: Status $($response3.StatusCode)" -ForegroundColor Green
    Write-Host "Response:" -ForegroundColor Cyan
    $response3.Content | ConvertFrom-Json | ConvertTo-Json -Depth 5
} catch {
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        Write-Host "Status Code: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Red
        Write-Host "Status Description: $($_.Exception.Response.StatusDescription)" -ForegroundColor Red
        
        try {
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            $responseBody = $reader.ReadToEnd()
            Write-Host "Response Body: $responseBody" -ForegroundColor Yellow
        } catch {
            Write-Host "Could not read response body" -ForegroundColor Gray
        }
    }
}

# Test 4: Check camera exists
Write-Host "`n[Test 4] GET /cameras (check if camera exists)..." -ForegroundColor Green
$camerasUrl = "$BaseUrl/cameras"
Write-Host "URL: $camerasUrl" -ForegroundColor Gray

try {
    $response4 = Invoke-WebRequest -Uri $camerasUrl -Headers @{
        "Authorization" = "Bearer $Token"
    } -UseBasicParsing -ErrorAction Stop
    
    Write-Host "SUCCESS: Status $($response4.StatusCode)" -ForegroundColor Green
    
    $cameras = $response4.Content | ConvertFrom-Json
    $targetCamera = $cameras | Where-Object { $_.id -eq $CameraId }
    
    if ($targetCamera) {
        Write-Host "`nCamera Found:" -ForegroundColor Green
        $targetCamera | ConvertTo-Json -Depth 3
    } else {
        Write-Host "`nCamera NOT found with ID: $CameraId" -ForegroundColor Red
        Write-Host "Available cameras:" -ForegroundColor Yellow
        $cameras | Select-Object id, name | Format-Table
    }
} catch {
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n=== Test Complete ===" -ForegroundColor Cyan
Write-Host "`nRecommendations:" -ForegroundColor Yellow
Write-Host "1. If Test 2 fails but Test 1 works: Frontend should remove protocol param from proxy URL" -ForegroundColor Gray
Write-Host "2. If Test 3 works: Frontend should use /url endpoint instead of /proxy" -ForegroundColor Gray
Write-Host "3. If camera not found: Check database or use different camera ID" -ForegroundColor Gray
Write-Host "4. Check Coolify logs for detailed error stack trace" -ForegroundColor Gray
