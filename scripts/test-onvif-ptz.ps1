# ONVIF PTZ Quick Test Script
# Tested with: Dahua camera at 192.168.1.66

# ============================================
# CONFIGURATION
# ============================================
$baseUrl = "http://localhost:3000"
$cameraIp = "192.168.1.66"

# TODO: Lấy JWT token trước bằng cách login
# POST /auth/login { "username": "admin", "password": "your-pass" }
$token = "YOUR_JWT_TOKEN_HERE"

# TODO: Lấy camera ID sau khi tạo camera
# POST /cameras hoặc GET /cameras
$cameraId = "YOUR_CAMERA_UUID_HERE"

# ============================================
# SETUP HEADERS
# ============================================
$headers = @{
    Authorization = "Bearer $token"
    "Content-Type" = "application/json"
}

# ============================================
# HELPER FUNCTIONS
# ============================================
function Send-PTZCommand {
    param(
        [string]$Action,
        [int]$Speed = 5,
        [int]$DurationMs = 2000
    )
    
    Write-Host "`n┌──────────────────────────────────────────┐" -ForegroundColor Cyan
    Write-Host "│  PTZ Command: $Action" -ForegroundColor Cyan
    Write-Host "│  Speed: $Speed | Duration: ${DurationMs}ms" -ForegroundColor Cyan
    Write-Host "└──────────────────────────────────────────┘" -ForegroundColor Cyan
    
    try {
        $body = @{
            action = $Action
            speed = $Speed
            durationMs = $DurationMs
        } | ConvertTo-Json
        
        $response = Invoke-RestMethod `
            -Uri "$baseUrl/cameras/$cameraId/ptz" `
            -Method POST `
            -Headers $headers `
            -Body $body
        
        Write-Host "✅ Success: $($response.action)" -ForegroundColor Green
        Write-Host "   Vector: Pan=$($response.vector.pan), Tilt=$($response.vector.tilt), Zoom=$($response.vector.zoom)" -ForegroundColor Gray
        return $true
    }
    catch {
        Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

function Send-Stop {
    Write-Host "`n🛑 Sending STOP command..." -ForegroundColor Yellow
    try {
        $body = '{"action":"STOP"}' 
        $response = Invoke-RestMethod `
            -Uri "$baseUrl/cameras/$cameraId/ptz" `
            -Method POST `
            -Headers $headers `
            -Body $body
        Write-Host "✅ Camera stopped" -ForegroundColor Green
    }
    catch {
        Write-Host "❌ Stop failed: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# ============================================
# VALIDATE CONFIGURATION
# ============================================
Write-Host "============================================" -ForegroundColor Magenta
Write-Host "  ONVIF PTZ Test Suite" -ForegroundColor Magenta
Write-Host "============================================" -ForegroundColor Magenta

if ($token -eq "YOUR_JWT_TOKEN_HERE") {
    Write-Host "❌ Error: Please set JWT token!" -ForegroundColor Red
    Write-Host "   1. Login: POST $baseUrl/auth/login" -ForegroundColor Yellow
    Write-Host "   2. Copy accessToken from response" -ForegroundColor Yellow
    Write-Host "   3. Update `$token variable in this script" -ForegroundColor Yellow
    exit 1
}

if ($cameraId -eq "YOUR_CAMERA_UUID_HERE") {
    Write-Host "❌ Error: Please set camera ID!" -ForegroundColor Red
    Write-Host "   1. Create camera: POST $baseUrl/cameras" -ForegroundColor Yellow
    Write-Host "   2. Or list cameras: GET $baseUrl/cameras" -ForegroundColor Yellow
    Write-Host "   3. Update `$cameraId variable in this script" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Configuration OK" -ForegroundColor Green
Write-Host "   Camera IP: $cameraIp" -ForegroundColor Gray
Write-Host "   Base URL: $baseUrl" -ForegroundColor Gray
Write-Host "   Camera ID: $cameraId" -ForegroundColor Gray

# ============================================
# TEST SUITE
# ============================================

Write-Host "`n📋 Starting PTZ tests..." -ForegroundColor Cyan
Write-Host "   Watch server logs for ONVIF connection details" -ForegroundColor Gray

# Test 1: Pan Left
Send-PTZCommand -Action "PAN_LEFT" -Speed 5 -DurationMs 2000
Start-Sleep -Seconds 3

# Test 2: Pan Right
Send-PTZCommand -Action "PAN_RIGHT" -Speed 5 -DurationMs 2000
Start-Sleep -Seconds 3

# Test 3: Tilt Up
Send-PTZCommand -Action "TILT_UP" -Speed 5 -DurationMs 2000
Start-Sleep -Seconds 3

# Test 4: Tilt Down
Send-PTZCommand -Action "TILT_DOWN" -Speed 5 -DurationMs 2000
Start-Sleep -Seconds 3

# Test 5: Diagonal - Pan Left + Tilt Up
Send-PTZCommand -Action "PAN_LEFT_UP" -Speed 4 -DurationMs 2000
Start-Sleep -Seconds 3

# Test 6: Diagonal - Pan Right + Tilt Down
Send-PTZCommand -Action "PAN_RIGHT_DOWN" -Speed 4 -DurationMs 2000
Start-Sleep -Seconds 3

# Test 7: Zoom In
Send-PTZCommand -Action "ZOOM_IN" -Speed 3 -DurationMs 3000
Start-Sleep -Seconds 4

# Test 8: Zoom Out
Send-PTZCommand -Action "ZOOM_OUT" -Speed 3 -DurationMs 3000
Start-Sleep -Seconds 4

# Test 9: Manual Stop (emergency)
Write-Host "`n⚠️  Testing manual STOP (emergency brake)..." -ForegroundColor Yellow
Send-PTZCommand -Action "PAN_LEFT" -Speed 8 -DurationMs 10000
Start-Sleep -Seconds 2
Send-Stop
Start-Sleep -Seconds 2

# ============================================
# RESULTS
# ============================================
Write-Host "`n============================================" -ForegroundColor Green
Write-Host "  ✅ PTZ Test Suite Completed!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green

Write-Host "`n📊 Check Results:" -ForegroundColor Cyan
Write-Host "   1. Camera should have moved physically" -ForegroundColor Gray
Write-Host "   2. Server logs show ONVIF commands sent" -ForegroundColor Gray
Write-Host "   3. Database has PTZ log entries" -ForegroundColor Gray

Write-Host "`n💡 Next Steps:" -ForegroundColor Yellow
Write-Host "   • View PTZ logs: GET $baseUrl/cameras/$cameraId/ptz/logs" -ForegroundColor Gray
Write-Host "   • Check status: GET $baseUrl/cameras/$cameraId/ptz/status" -ForegroundColor Gray
Write-Host "   • Advanced logs: GET $baseUrl/cameras/ptz/logs/advanced" -ForegroundColor Gray

Write-Host "`n🎥 Camera IP: $cameraIp - Should see movements!" -ForegroundColor Green
