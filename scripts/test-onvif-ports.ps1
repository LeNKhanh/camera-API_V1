# Test ONVIF with different ports
$token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6ImFkbWluIiwicm9sZSI6IkFETUlOIiwiaWQiOiI3MDEyYTNhMS02MjFhLTQzOWItYmJjMC00MWFiMGVjM2JjNTAiLCJpYXQiOjE3MjgzNTkxNzgsImV4cCI6MTcyODM2Mjc3OH0.OxSZpRGFXr00oH5AvgNxm0zZqPMi6KYy76X5C_1lT-4"
$cameraId = "7e53c1d5-1c65-482a-af06-463e0d334517"

$ports = @(80, 8000, 8080, 8899, 554, 37777)

foreach ($port in $ports) {
    Write-Host "`n🔍 Testing ONVIF Port: $port" -ForegroundColor Cyan
    
    try {
        $result = Invoke-RestMethod -Uri "http://localhost:3000/cameras/$cameraId" `
            -Method PATCH `
            -Headers @{ Authorization = "Bearer $token" } `
            -ContentType "application/json" `
            -Body "{`"onvifPort`": $port}"
        
        Write-Host "  ✅ Updated camera onvifPort to $port" -ForegroundColor Green
        
        # Try PTZ command
        Start-Sleep -Seconds 2
        Write-Host "  🎥 Testing PTZ..." -ForegroundColor Yellow
        
        try {
            $ptzResult = Invoke-RestMethod -Uri "http://localhost:3000/cameras/$cameraId/ptz" `
                -Method POST `
                -Headers @{ Authorization = "Bearer $token" } `
                -ContentType "application/json" `
                -Body '{"action":"PAN_LEFT","speed":3,"durationMs":1000}'
            
            Write-Host "  ✅ ✅ ✅ SUCCESS with port $port!" -ForegroundColor Green
            Write-Host "  🎉 ONVIF working on port $port!" -ForegroundColor Green
            break
        }
        catch {
            Write-Host "  ❌ PTZ failed with port $port" -ForegroundColor Red
        }
    }
    catch {
        Write-Host "  ❌ Failed to update port: $_" -ForegroundColor Red
    }
    
    Start-Sleep -Seconds 1
}

Write-Host "`n📝 Check server logs for detailed error messages" -ForegroundColor Cyan
