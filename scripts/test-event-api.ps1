# Test Event API với filter nChannelID

Write-Host "Login..." -ForegroundColor Cyan
$login = Invoke-RestMethod -Method POST -Uri http://localhost:3000/auth/login `
  -Body (@{ username='admin'; password='admin123' } | ConvertTo-Json) `
  -ContentType 'application/json'
$token = $login.accessToken
Write-Host "Token received" -ForegroundColor Green

Write-Host ""
Write-Host "Test 1: GET /events (all events)" -ForegroundColor Cyan
$allEvents = Invoke-RestMethod -Uri http://localhost:3000/events `
  -Headers @{ Authorization="Bearer $token" }
Write-Host "Total events: $($allEvents.Count)"
$allEvents | Select-Object -First 3 | ForEach-Object {
  Write-Host "  - [$($_.nChannelID)] $($_.type) on $($_.camera.name)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Test 2: GET /events?nChannelID=2 (filter by channel 2)" -ForegroundColor Cyan
$channel2Events = Invoke-RestMethod -Uri "http://localhost:3000/events?nChannelID=2" `
  -Headers @{ Authorization="Bearer $token" }
Write-Host "Events on channel 2: $($channel2Events.Count)"
$channel2Events | ForEach-Object {
  Write-Host "  - [$($_.nChannelID)] $($_.type) on $($_.camera.name)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Test 3: GET /events?nChannelID=1 (filter by channel 1)" -ForegroundColor Cyan
$channel1Events = Invoke-RestMethod -Uri "http://localhost:3000/events?nChannelID=1" `
  -Headers @{ Authorization="Bearer $token" }
Write-Host "Events on channel 1: $($channel1Events.Count)"
$channel1Events | ForEach-Object {
  Write-Host "  - [$($_.nChannelID)] $($_.type) on $($_.camera.name)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Test 4: Tao event moi voi camera channel=2" -ForegroundColor Cyan
$cameras = Invoke-RestMethod -Uri http://localhost:3000/cameras `
  -Headers @{ Authorization="Bearer $token" }
$camera2 = $cameras | Where-Object { $_.channel -eq 2 } | Select-Object -First 1

if ($camera2) {
  Write-Host "Camera: $($camera2.name) (channel=$($camera2.channel))"
  
  $newEvent = Invoke-RestMethod -Method POST -Uri http://localhost:3000/events `
    -Headers @{ Authorization="Bearer $token" } `
    -Body (@{
      cameraId = $camera2.id
      type = 'ALERT'
      description = "Test event from PowerShell - channel $($camera2.channel)"
    } | ConvertTo-Json) `
    -ContentType 'application/json'
  
  Write-Host "Event created: $($newEvent.id)" -ForegroundColor Green
  Write-Host "   - nChannelID: $($newEvent.nChannelID) (should be $($camera2.channel))"
  Write-Host "   - Type: $($newEvent.type)"
  Write-Host "   - Description: $($newEvent.description)"
  
  if ($newEvent.nChannelID -eq $camera2.channel) {
    Write-Host "   nChannelID correctly inherited from camera!" -ForegroundColor Green
  } else {
    Write-Host "   nChannelID mismatch!" -ForegroundColor Red
  }
} else {
  Write-Host "No camera with channel=2 found" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "All tests completed!" -ForegroundColor Green
