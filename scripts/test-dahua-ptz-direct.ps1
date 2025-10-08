# Test Dahua PTZ API directly
# Tìm đúng URL format cho camera

$cameraIP = "192.168.1.66"
$username = "aidev"
$password = "aidev123"

# Create credential
$secpasswd = ConvertTo-SecureString $password -AsPlainText -Force
$credential = New-Object System.Management.Automation.PSCredential ($username, $secpasswd)

Write-Host "🔍 Testing Dahua PTZ API formats..." -ForegroundColor Cyan
Write-Host ""

# Test 1: Standard format with channel 0
Write-Host "Test 1: Standard format (channel=0, code=Left)" -ForegroundColor Yellow
$url1 = "http://$cameraIP/cgi-bin/ptz.cgi?action=start&channel=0&code=Left&arg1=0&arg2=5&arg3=0"
Write-Host "URL: $url1"
try {
    $response = Invoke-WebRequest -Uri $url1 -Credential $credential -Method Get -TimeoutSec 5
    Write-Host "✅ SUCCESS! Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "Response: $($response.Content)" -ForegroundColor Green
    Write-Host ""
} catch {
    Write-Host "❌ FAILED: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
}

# Test 2: With channel 1
Write-Host "Test 2: Channel 1 (code=Left)" -ForegroundColor Yellow
$url2 = "http://$cameraIP/cgi-bin/ptz.cgi?action=start&channel=1&code=Left&arg1=0&arg2=5&arg3=0"
Write-Host "URL: $url2"
try {
    $response = Invoke-WebRequest -Uri $url2 -Credential $credential -Method Get -TimeoutSec 5
    Write-Host "✅ SUCCESS! Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "Response: $($response.Content)" -ForegroundColor Green
    Write-Host ""
} catch {
    Write-Host "❌ FAILED: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
}

# Test 3: Without channel parameter
Write-Host "Test 3: No channel parameter" -ForegroundColor Yellow
$url3 = "http://$cameraIP/cgi-bin/ptz.cgi?action=start&code=Left&arg1=0&arg2=5&arg3=0"
Write-Host "URL: $url3"
try {
    $response = Invoke-WebRequest -Uri $url3 -Credential $credential -Method Get -TimeoutSec 5
    Write-Host "✅ SUCCESS! Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "Response: $($response.Content)" -ForegroundColor Green
    Write-Host ""
} catch {
    Write-Host "❌ FAILED: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
}

# Test 4: Different code format (numeric)
Write-Host "Test 4: Numeric code (code=4 for Left)" -ForegroundColor Yellow
$url4 = "http://$cameraIP/cgi-bin/ptz.cgi?action=start&channel=1&code=4&arg1=0&arg2=5&arg3=0"
Write-Host "URL: $url4"
try {
    $response = Invoke-WebRequest -Uri $url4 -Credential $credential -Method Get -TimeoutSec 5
    Write-Host "✅ SUCCESS! Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "Response: $($response.Content)" -ForegroundColor Green
    Write-Host ""
} catch {
    Write-Host "❌ FAILED: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
}

# Test 5: Alternative PTZ endpoint
Write-Host "Test 5: Alternative endpoint (/ptz.cgi without params)" -ForegroundColor Yellow
$url5 = "http://$cameraIP/cgi-bin/ptz.cgi"
Write-Host "URL: $url5"
try {
    $response = Invoke-WebRequest -Uri $url5 -Credential $credential -Method Get -TimeoutSec 5
    Write-Host "✅ Connected! Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "Response: $($response.Content)" -ForegroundColor Green
    Write-Host ""
} catch {
    Write-Host "❌ FAILED: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
}

# Test 6: Check capabilities
Write-Host "Test 6: PTZ capabilities" -ForegroundColor Yellow
$url6 = "http://$cameraIP/cgi-bin/ptz.cgi?action=getStatus"
Write-Host "URL: $url6"
try {
    $response = Invoke-WebRequest -Uri $url6 -Credential $credential -Method Get -TimeoutSec 5
    Write-Host "✅ SUCCESS! Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "Response: $($response.Content)" -ForegroundColor Green
    Write-Host ""
} catch {
    Write-Host "❌ FAILED: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
}

# Test 7: Try devVideoInput endpoint (alternative Dahua API)
Write-Host "Test 7: devVideoInput PTZ endpoint" -ForegroundColor Yellow
$url7 = "http://$cameraIP/cgi-bin/devVideoInput.cgi?action=adjustFocus&focus=0.5"
Write-Host "URL: $url7"
try {
    $response = Invoke-WebRequest -Uri $url7 -Credential $credential -Method Get -TimeoutSec 5
    Write-Host "✅ SUCCESS! Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "Response: $($response.Content)" -ForegroundColor Green
    Write-Host ""
} catch {
    Write-Host "❌ FAILED: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
}

# Test 8: Try configManager to get PTZ config
Write-Host "Test 8: Get PTZ configuration" -ForegroundColor Yellow
$url8 = "http://$cameraIP/cgi-bin/configManager.cgi?action=getConfig&name=PTZ"
Write-Host "URL: $url8"
try {
    $response = Invoke-WebRequest -Uri $url8 -Credential $credential -Method Get -TimeoutSec 5
    Write-Host "✅ SUCCESS! Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "PTZ Config:" -ForegroundColor Green
    Write-Host $response.Content
    Write-Host ""
} catch {
    Write-Host "❌ FAILED: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
}

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "Test completed! Check which format worked." -ForegroundColor Cyan
Write-Host "Copy the successful URL format to use in code." -ForegroundColor Green
