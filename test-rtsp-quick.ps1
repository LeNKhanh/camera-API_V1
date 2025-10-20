# Quick Test RTSP URL
# Run: .\test-rtsp-quick.ps1

$cameraId = "49e77c80-af6e-4ac6-b0ea-b4f018dacac7"

Write-Host "Testing RTSP URL endpoint..." -ForegroundColor Cyan

# Login
$login = Invoke-RestMethod -Method Post `
    -Uri "http://localhost:3000/auth/login" `
    -ContentType "application/json" `
    -Body '{"username":"admin","password":"admin123"}'

$token = $login.access_token
Write-Host "Token: $($token.Substring(0,20))..." -ForegroundColor Green

# Get RTSP URL
Write-Host "`nGetting RTSP URL..." -ForegroundColor Yellow

try {
    $result = Invoke-RestMethod -Method Get `
        -Uri "http://localhost:3000/streams/$cameraId/rtsp" `
        -Headers @{ Authorization = "Bearer $token" }
    
    Write-Host "`n✅ SUCCESS!" -ForegroundColor Green
    Write-Host "`nCamera: $($result.cameraName)" -ForegroundColor White
    Write-Host "RTSP URL:" -ForegroundColor Yellow
    Write-Host $result.rtspUrl -ForegroundColor Green
    
    Write-Host "`nFull Response:" -ForegroundColor Cyan
    $result | ConvertTo-Json -Depth 10
    
} catch {
    Write-Host "`n❌ ERROR!" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    
    if ($_.Exception.Response) {
        $statusCode = $_.Exception.Response.StatusCode.value__
        Write-Host "Status Code: $statusCode" -ForegroundColor Yellow
    }
}
