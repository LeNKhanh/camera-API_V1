# Setup Cloudflare R2 Public Access

## ⚠️ Vấn Đề Hiện Tại

Response API trả về URL:
```
https://a1000a80a775f57fe92ea14196486a3a.r2.cloudflarestorage.com/iotek/snapshots/...
```

URL này **KHÔNG mở được** trong browser vì:
- Đây là API endpoint (cần authentication)
- Không phải public URL

## ✅ Giải Pháp: Enable R2 Public Access

### Bước 1: Vào Cloudflare Dashboard

1. Truy cập: https://dash.cloudflare.com
2. Click **R2** ở sidebar
3. Click bucket **iotek**

### Bước 2: Enable R2.dev Subdomain

1. Click tab **Settings**
2. Tìm section **"Public Access"**
3. Click **"Connect a domain"** hoặc **"Allow Access"**
4. Chọn **"R2.dev subdomain"** (free option)
5. Click **Enable**

Bạn sẽ nhận được URL dạng:
```
https://pub-abc123xyz.r2.dev
```

### Bước 3: Update .env

Copy public URL và update `.env`:

```bash
# Cloudflare R2 Storage Configuration
R2_ENDPOINT=https://a1000a80a775f57fe92ea14196486a3a.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=0c10ee4c19fe892894a9c5311798a69c
R2_SECRET_ACCESS_KEY=20db186ea3ebb14ba05254a9b82b1f033fef297335ab8d4e7874e90634ca36bb
R2_BUCKET_NAME=iotek

# ⬇️ ADD THIS LINE với URL từ Cloudflare
R2_PUBLIC_URL=https://pub-abc123xyz.r2.dev

STORAGE_MODE=r2
```

### Bước 4: Restart Server

```powershell
# Stop current server (Ctrl+C nếu đang chạy)

# Restart
npm run start:dev
```

### Bước 5: Test

Capture snapshot mới:
```powershell
# Login
$body = @{username="admin";password="admin123"} | ConvertTo-Json
$login = Invoke-RestMethod -Uri "http://localhost:3000/auth/login" -Method Post -ContentType "application/json" -Body $body
$token = $login.access_token

# Capture
$snap = @{cameraId="6b6dd4e4-b3a9-4fce-ae61-4c288c73856b";strategy="FAKE"} | ConvertTo-Json
$result = Invoke-RestMethod -Uri "http://localhost:3000/snapshots/capture" -Method Post -ContentType "application/json" -Headers @{Authorization="Bearer $token"} -Body $snap

# Check URL
Write-Host "Storage Path: $($result.storagePath)"
# Should show: https://pub-abc123xyz.r2.dev/snapshots/...

# Open in browser
Start-Process $result.storagePath
```

---

## 🎯 Kết Quả Mong Đợi

### Trước khi setup:
```json
{
  "storagePath": "https://a1000a80a775f57fe92ea14196486a3a.r2.cloudflarestorage.com/iotek/snapshots/..."
}
```
❌ Không mở được trong browser

### Sau khi setup:
```json
{
  "storagePath": "https://pub-abc123xyz.r2.dev/snapshots/..."
}
```
✅ Mở được trong browser, hiển thị ảnh!

---

## 📋 Alternative: Custom Domain (Optional)

Nếu muốn URL đẹp hơn:

### Bước 1: Add Domain
1. R2 Dashboard → Bucket `iotek` → Settings
2. **Custom Domains** → Add domain
3. Ví dụ: `cdn.yourdomain.com`

### Bước 2: Update DNS
Follow hướng dẫn Cloudflare để add CNAME record

### Bước 3: Update .env
```bash
R2_PUBLIC_URL=https://cdn.yourdomain.com
```

URLs sẽ là:
```
https://cdn.yourdomain.com/snapshots/...
```

---

## 🔒 Security Note

**Public Access** có nghĩa:
- ✅ Bất kỳ ai có link đều xem được file
- ❌ Không cần authentication
- ⚠️ Nếu cần bảo mật cao → sử dụng **Pre-signed URLs** (expire sau X giờ)

**Pre-signed URLs** (tùy chọn nâng cao):
```typescript
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const command = new GetObjectCommand({
  Bucket: 'iotek',
  Key: 'snapshots/cam1/image.jpg',
});

// URL expire sau 1 giờ
const url = await getSignedUrl(this.s3Client, command, { 
  expiresIn: 3600 
});
```

---

## ✅ Summary

1. **API Endpoint** (`a1000a80a775f57fe92ea14196486a3a.r2.cloudflarestorage.com`):
   - Dùng trong code để upload/download/delete
   - Cần authentication
   - KHÔNG dùng để view trong browser

2. **Public URL** (`pub-xxxxx.r2.dev`):
   - Dùng để xem files trong browser
   - Không cần authentication
   - Cần enable trên Cloudflare Dashboard

**Next step:** Enable R2.dev subdomain để có public URL!
