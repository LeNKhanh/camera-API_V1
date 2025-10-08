# Test PTZ via API with correct channel=2
$cameraId = "7e53c1d5-1c65-482a-af06-463e0d334517"
$apiUrl = "http://localhost:3000/cameras/$cameraId/ptz"

Write-Host "🎯 Testing PTZ API (channel=2 format)" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Test 1: Pan Left
Write-Host "1. Testing PAN_LEFT..." -ForegroundColor Yellow
$body1 = @{
    action = "PAN_LEFT"
    speed = 5
    duration = 2000
} | ConvertTo-Json

try {
    $response1 = Invoke-RestMethod -Uri $apiUrl -Method POST -Body $body1 -ContentType "application/json"
    Write-Host "   ✅ SUCCESS!" -ForegroundColor Green
    Write-Host "   Response: $($response1 | ConvertTo-Json -Depth 3)"
} catch {
    Write-Host "   ❌ FAILED: $($_.Exception.Message)" -ForegroundColor Red
}

Start-Sleep -Seconds 3

# Test 2: Pan Right
Write-Host "`n2. Testing PAN_RIGHT..." -ForegroundColor Yellow
$body2 = @{
    action = "PAN_RIGHT"
    speed = 5
    duration = 2000
} | ConvertTo-Json

try {
    $response2 = Invoke-RestMethod -Uri $apiUrl -Method POST -Body $body2 -ContentType "application/json"
    Write-Host "   ✅ SUCCESS!" -ForegroundColor Green
    Write-Host "   Response: $($response2 | ConvertTo-Json -Depth 3)"
} catch {
    Write-Host "   ❌ FAILED: $($_.Exception.Message)" -ForegroundColor Red
}

Start-Sleep -Seconds 3

# Test 3: Tilt Up
Write-Host "`n3. Testing TILT_UP..." -ForegroundColor Yellow
$body3 = @{
    action = "TILT_UP"
    speed = 5
    duration = 2000
} | ConvertTo-Json

try {
    $response3 = Invoke-RestMethod -Uri $apiUrl -Method POST -Body $body3 -ContentType "application/json"
    Write-Host "   ✅ SUCCESS!" -ForegroundColor Green
    Write-Host "   Response: $($response3 | ConvertTo-Json -Depth 3)"
} catch {
    Write-Host "   ❌ FAILED: $($_.Exception.Message)" -ForegroundColor Red
}

Start-Sleep -Seconds 3

# Test 4: Tilt Down
Write-Host "`n4. Testing TILT_DOWN..." -ForegroundColor Yellow
$body4 = @{
    action = "TILT_DOWN"
    speed = 5
    duration = 2000
} | ConvertTo-Json

try {
    $response4 = Invoke-RestMethod -Uri $apiUrl -Method POST -Body $body4 -ContentType "application/json"
    Write-Host "   ✅ SUCCESS!" -ForegroundColor Green
    Write-Host "   Response: $($response4 | ConvertTo-Json -Depth 3)"
} catch {
    Write-Host "   ❌ FAILED: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "✅ PTZ Testing Complete!" -ForegroundColor Green
Write-Host "Watch the camera to see if it moves!" -ForegroundColor Yellow
