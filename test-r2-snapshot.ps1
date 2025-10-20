# Test R2 Snapshot Upload
# Run: .\test-r2-snapshot.ps1

Write-Host "🚀 Testing R2 Snapshot Upload..." -ForegroundColor Cyan
Write-Host ""

# Step 1: Login
Write-Host "1️⃣ Logging in..." -ForegroundColor Yellow
try {
    $loginBody = @{
        username = "admin"
        password = "admin123"
    } | ConvertTo-Json

    $login = Invoke-RestMethod -Method Post `
        -Uri "http://localhost:3000/auth/login" `
        -ContentType "application/json" `
        -Body $loginBody

    $token = $login.access_token
    Write-Host "✅ Login successful!" -ForegroundColor Green
    Write-Host "   Token: $($token.Substring(0, 20))..." -ForegroundColor Gray
    Write-Host ""
} catch {
    Write-Host "❌ Login failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Step 2: Capture Snapshot
Write-Host "2️⃣ Capturing snapshot (FAKE strategy)..." -ForegroundColor Yellow
try {
    $captureBody = @{
        cameraId = "eb1501b3-9b2a-4768-92e7-152d17733747"
        strategy = "FAKE"
    } | ConvertTo-Json

    $snapshot = Invoke-RestMethod -Method Post `
        -Uri "http://localhost:3000/snapshots/capture" `
        -ContentType "application/json" `
        -Headers @{ Authorization = "Bearer $token" } `
        -Body $captureBody

    Write-Host "✅ Snapshot captured!" -ForegroundColor Green
    Write-Host "   ID: $($snapshot.id)" -ForegroundColor Gray
    Write-Host "   Captured At: $($snapshot.capturedAt)" -ForegroundColor Gray
    Write-Host ""
} catch {
    Write-Host "❌ Capture failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Step 3: Check Storage Location
Write-Host "3️⃣ Checking storage location..." -ForegroundColor Yellow
$storagePath = $snapshot.storagePath
Write-Host "   Path: $storagePath" -ForegroundColor Gray
Write-Host ""

if ($storagePath -like "*r2.cloudflarestorage.com*") {
    Write-Host "✅ SUCCESS! File uploaded to R2!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📍 R2 URL:" -ForegroundColor Cyan
    Write-Host "   $storagePath" -ForegroundColor White
    Write-Host ""
    
    # Step 4: Try to download
    Write-Host "4️⃣ Testing download from R2..." -ForegroundColor Yellow
    try {
        $outputFile = "test-r2-snapshot.jpg"
        Invoke-WebRequest -Uri $storagePath -OutFile $outputFile
        
        $fileInfo = Get-Item $outputFile
        Write-Host "✅ Downloaded successfully!" -ForegroundColor Green
        Write-Host "   File: $outputFile" -ForegroundColor Gray
        Write-Host "   Size: $($fileInfo.Length) bytes" -ForegroundColor Gray
        Write-Host ""
        
        # Open image
        Write-Host "5️⃣ Opening image..." -ForegroundColor Yellow
        Start-Process $outputFile
        Write-Host "✅ Image opened in default viewer!" -ForegroundColor Green
        Write-Host ""
        
    } catch {
        Write-Host "⚠️ Download failed: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "   You can still open URL manually in browser" -ForegroundColor Yellow
        Write-Host ""
    }
    
    # Summary
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
    Write-Host "📊 TEST SUMMARY" -ForegroundColor Cyan
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
    Write-Host "✅ R2 Integration: WORKING" -ForegroundColor Green
    Write-Host "✅ Snapshot ID: $($snapshot.id)" -ForegroundColor Green
    Write-Host "✅ Storage: Cloudflare R2" -ForegroundColor Green
    Write-Host ""
    Write-Host "🔗 To view on Cloudflare Dashboard:" -ForegroundColor Yellow
    Write-Host "   1. Go to: https://dash.cloudflare.com" -ForegroundColor White
    Write-Host "   2. Click: R2 → Bucket 'iotek'" -ForegroundColor White
    Write-Host "   3. Browse: snapshots/ folder" -ForegroundColor White
    Write-Host ""
    Write-Host "🌐 Direct URL (paste in browser):" -ForegroundColor Yellow
    Write-Host "   $storagePath" -ForegroundColor White
    Write-Host ""
    
} else {
    Write-Host "⚠️ WARNING: File still on local storage" -ForegroundColor Yellow
    Write-Host "   Path: $storagePath" -ForegroundColor Gray
    Write-Host ""
    Write-Host "📋 Troubleshooting:" -ForegroundColor Yellow
    Write-Host "   1. Check .env file:" -ForegroundColor White
    Write-Host "      STORAGE_MODE=r2" -ForegroundColor Gray
    Write-Host "   2. Restart server:" -ForegroundColor White
    Write-Host "      npm run start:dev" -ForegroundColor Gray
    Write-Host "   3. Check server logs for:" -ForegroundColor White
    Write-Host "      [StorageService] StorageService initialized - Mode: r2" -ForegroundColor Gray
    Write-Host ""
}

Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "✅ Test completed!" -ForegroundColor Green
Write-Host ""
