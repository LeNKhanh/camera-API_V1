# Hướng Dẫn Kiểm Tra Files Trên Cloudflare R2

## 🌐 Cách 1: Xem Trực Tiếp Trên Cloudflare Dashboard

### Bước 1: Đăng nhập Cloudflare
1. Truy cập: https://dash.cloudflare.com
2. Đăng nhập với tài khoản của bạn

### Bước 2: Vào R2 Dashboard
1. Từ sidebar bên trái, click **R2**
2. Hoặc truy cập trực tiếp: https://dash.cloudflare.com/?to=/:account/r2

### Bước 3: Chọn Bucket
1. Click vào bucket **iotek**
2. Browse qua các folders:
   - `snapshots/` - Chứa ảnh snapshot
   - `recordings/` - Chứa video recording

### Bước 4: Xem Files
- Click vào folder cụ thể (ví dụ: `snapshots/cam1/`)
- Bạn sẽ thấy danh sách các files với:
  - **File name**: `1729440000000-abc123.jpg`
  - **Size**: Kích thước file
  - **Last modified**: Thời gian upload
  - **Actions**: Download/Delete/Copy URL

### Bước 5: Tải Ảnh Về
1. Click vào file muốn xem
2. Click nút **Download** để tải về máy
3. Hoặc click **Copy URL** để lấy link public

---

## 📱 Cách 2: Test API Để Capture và Verify

### Bước 1: Chạy Test Script

Tạo file `test-r2-snapshot.ps1`:

\`\`\`powershell
# Lấy JWT Token
$loginResponse = Invoke-RestMethod -Method Post -Uri "http://localhost:3000/auth/login" `
    -ContentType "application/json" `
    -Body '{"username":"admin","password":"admin123"}'

$token = $loginResponse.access_token
Write-Host "✅ Đăng nhập thành công, JWT: $token"

# Capture snapshot với FAKE strategy
$captureResponse = Invoke-RestMethod -Method Post -Uri "http://localhost:3000/snapshots/capture" `
    -ContentType "application/json" `
    -Headers @{ "Authorization" = "Bearer $token" } `
    -Body '{"cameraId":"eb1501b3-9b2a-4768-92e7-152d17733747","strategy":"FAKE"}'

Write-Host "✅ Snapshot captured!"
Write-Host "📍 Storage Path: $($captureResponse.storagePath)"
Write-Host "🆔 Snapshot ID: $($captureResponse.id)"

# Verify trên R2
if ($captureResponse.storagePath -match "r2.cloudflarestorage.com") {
    Write-Host "✅ File đã upload lên R2 thành công!"
    Write-Host "🔗 R2 URL: $($captureResponse.storagePath)"
} else {
    Write-Host "⚠️ File vẫn ở local: $($captureResponse.storagePath)"
}
\`\`\`

### Bước 2: Chạy Script

\`\`\`powershell
cd d:\camera_Api\Camera-api
.\test-r2-snapshot.ps1
\`\`\`

### Bước 3: Copy R2 URL và Mở Trong Browser

Copy URL từ output và paste vào browser để xem ảnh.

---

## 🔗 Cách 3: Query Database Để Lấy R2 URLs

### Script Kiểm Tra Database

\`\`\`powershell
# File: check-r2-files.ps1

# Connect to PostgreSQL
$env:PGPASSWORD = "admin"

Write-Host "📊 Checking snapshots in database..."

$query = @"
SELECT 
    id, 
    camera_id,
    storage_path,
    captured_at,
    CASE 
        WHEN storage_path LIKE 'http%' THEN '✅ R2'
        ELSE '📁 Local'
    END as storage_type
FROM snapshots 
ORDER BY captured_at DESC 
LIMIT 10;
"@

psql -h localhost -U postgres -d Camera_api -c "$query"

Write-Host "`n📊 Checking recordings in database..."

$query2 = @"
SELECT 
    id,
    camera_id,
    storage_path,
    status,
    started_at,
    CASE 
        WHEN storage_path LIKE 'http%' THEN '✅ R2'
        ELSE '📁 Local'
    END as storage_type
FROM recordings 
ORDER BY started_at DESC 
LIMIT 10;
"@

psql -h localhost -U postgres -d Camera_api -c "$query2"
\`\`\`

Chạy:
\`\`\`powershell
.\check-r2-files.ps1
\`\`\`

---

## 🧪 Cách 4: Test Upload Ngay Bây Giờ (Recommended)

### Option A: Dùng PowerShell Script

\`\`\`powershell
# Quick test R2 upload
$loginBody = @{
    username = "admin"
    password = "admin123"
} | ConvertTo-Json

$login = Invoke-RestMethod -Method Post `
    -Uri "http://localhost:3000/auth/login" `
    -ContentType "application/json" `
    -Body $loginBody

$token = $login.access_token

# Capture snapshot
$captureBody = @{
    cameraId = "eb1501b3-9b2a-4768-92e7-152d17733747"
    strategy = "FAKE"
} | ConvertTo-Json

$snapshot = Invoke-RestMethod -Method Post `
    -Uri "http://localhost:3000/snapshots/capture" `
    -ContentType "application/json" `
    -Headers @{ Authorization = "Bearer $token" } `
    -Body $captureBody

Write-Host "✅ Snapshot created!" -ForegroundColor Green
Write-Host "📍 Path: $($snapshot.storagePath)" -ForegroundColor Yellow

# Check if R2
if ($snapshot.storagePath -like "*r2.cloudflarestorage.com*") {
    Write-Host "✅ SUCCESS! File on R2!" -ForegroundColor Green
    Write-Host "🔗 Open in browser:" -ForegroundColor Cyan
    Write-Host $snapshot.storagePath
    
    # Try to download
    Write-Host "`n📥 Testing download..."
    Invoke-WebRequest -Uri $snapshot.storagePath -OutFile "test-r2-image.jpg"
    Write-Host "✅ Downloaded to test-r2-image.jpg" -ForegroundColor Green
} else {
    Write-Host "⚠️ File still local" -ForegroundColor Yellow
}
\`\`\`

### Option B: Dùng cURL

\`\`\`bash
# Login
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' \
  -o token.json

# Extract token (manual)
$TOKEN = "paste_your_token_here"

# Capture snapshot
curl -X POST http://localhost:3000/snapshots/capture \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"cameraId":"eb1501b3-9b2a-4768-92e7-152d17733747","strategy":"FAKE"}' \
  | jq .
\`\`\`

---

## 📋 Cách 5: Check Server Logs

Server đang chạy sẽ log upload activity:

\`\`\`
[SNAPSHOT] Uploaded to R2 and deleted local temp { r2Url: 'https://...' }
\`\`\`

Enable debug để xem chi tiết:

\`\`\`bash
# Trong .env
DEBUG_SNAPSHOT=1
\`\`\`

Restart server, logs sẽ hiển thị:
\`\`\`
[StorageService] Uploading C:\tmp\abc.jpg to R2 key: snapshots/cam1/123.jpg
[StorageService] Successfully uploaded to R2: https://...
[SNAPSHOT] Uploaded to R2 and deleted local temp
\`\`\`

---

## 🎯 Quick Test Commands

### Test 1: Capture Snapshot
\`\`\`powershell
# Set environment
$token = "YOUR_JWT_TOKEN"

# Capture
Invoke-RestMethod -Method Post `
    -Uri "http://localhost:3000/snapshots/capture" `
    -Headers @{ Authorization = "Bearer $token" } `
    -ContentType "application/json" `
    -Body '{"cameraId":"eb1501b3-9b2a-4768-92e7-152d17733747","strategy":"FAKE"}'
\`\`\`

### Test 2: List Snapshots
\`\`\`powershell
Invoke-RestMethod -Method Get `
    -Uri "http://localhost:3000/snapshots" `
    -Headers @{ Authorization = "Bearer $token" }
\`\`\`

### Test 3: Get Specific Snapshot
\`\`\`powershell
$snapshotId = "your_snapshot_id"
Invoke-RestMethod -Method Get `
    -Uri "http://localhost:3000/snapshots/$snapshotId" `
    -Headers @{ Authorization = "Bearer $token" }
\`\`\`

---

## ✅ Expected Results

Nếu R2 hoạt động đúng, bạn sẽ thấy:

### 1. API Response
\`\`\`json
{
  "id": "abc-123",
  "storagePath": "https://a1000a80a775f57fe92ea14196486a3a.r2.cloudflarestorage.com/iotek/snapshots/cam1/1729440000000-abc123.jpg",
  "capturedAt": "2025-10-20T..."
}
\`\`\`

### 2. Server Logs
\`\`\`
[StorageService] Uploading ... to R2 key: snapshots/...
[StorageService] Successfully uploaded to R2: https://...
[SNAPSHOT] Uploaded to R2 and deleted local temp
\`\`\`

### 3. Database
\`\`\`sql
SELECT storage_path FROM snapshots ORDER BY captured_at DESC LIMIT 1;
-- Result: https://...r2.cloudflarestorage.com/...
\`\`\`

### 4. Cloudflare R2 Dashboard
- File visible trong bucket `iotek/snapshots/`
- Size > 0
- Can download

---

## 🐛 Troubleshooting

### Vẫn Thấy Local Path?

Check:
1. \`\`\`bash
   # .env
   STORAGE_MODE=r2  # ← Phải là 'r2', không phải 'local'
   \`\`\`

2. Restart server sau khi đổi env:
   \`\`\`powershell
   # Kill old process
   Get-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess | Stop-Process -Force
   
   # Start new
   npm run start:dev
   \`\`\`

3. Check logs có thấy:
   \`\`\`
   [StorageService] StorageService initialized - Mode: r2, Bucket: iotek
   \`\`\`

### Upload Failed?

Check logs:
\`\`\`
[SNAPSHOT] R2 upload failed, keeping local file: ...
\`\`\`

Verify credentials:
\`\`\`powershell
# .env
R2_ACCESS_KEY_ID=0c10ee4c19fe892894a9c5311798a69c
R2_SECRET_ACCESS_KEY=20db186ea3ebb14ba05254a9b82b1f033fef297335ab8d4e7874e90634ca36bb
R2_ENDPOINT=https://a1000a80a775f57fe92ea14196486a3a.r2.cloudflarestorage.com
R2_BUCKET_NAME=iotek
\`\`\`

### Cannot Access R2 URL?

Bucket phải enable public access:
1. Cloudflare Dashboard → R2 → Bucket `iotek`
2. Settings → Public Access → Enable
3. Hoặc enable R2.dev subdomain

---

## 📸 Summary: Xem Ảnh Trên R2

**Cách nhanh nhất:**

1. ✅ Vào Cloudflare Dashboard: https://dash.cloudflare.com
2. ✅ R2 → Bucket `iotek` → Browse `snapshots/`
3. ✅ Click file → Download hoặc Copy URL

**Hoặc test API:**

1. ✅ Login → Get JWT token
2. ✅ POST `/snapshots/capture` với `strategy=FAKE`
3. ✅ Check response `storagePath` có URL R2
4. ✅ Open URL trong browser

**Status hiện tại của bạn:**
- ✅ Server running: http://localhost:3000
- ✅ R2 enabled: Mode = r2, Bucket = iotek
- ✅ Ready to test!
