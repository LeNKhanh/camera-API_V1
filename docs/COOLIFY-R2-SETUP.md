# Hướng dẫn Setup R2 Storage trên Coolify Production

## 📋 Tổng quan

Tài liệu này hướng dẫn cấu hình Environment Variables cho Cloudflare R2 trên môi trường production Coolify.

## 🔑 Environment Variables cần thiết

### 1. R2 Core Configuration (Bắt buộc)

```bash
# R2 API Endpoint (từ Cloudflare Dashboard)
R2_ENDPOINT=https://a1000a80a775f57fe92ea14196486a3a.r2.cloudflarestorage.com

# R2 Access Credentials (từ Cloudflare R2 API Tokens)
R2_ACCESS_KEY_ID=0c10ee4c19fe892894a9c5311798a69c
R2_SECRET_ACCESS_KEY=20db186ea3ebb14ba05254a9b82b1f033fef297335ab8d4e7874e90634ca36bb

# R2 Bucket Name
R2_BUCKET_NAME=iotek

# R2 Public URL (Custom domain hoặc R2.dev subdomain)
R2_PUBLIC_URL=https://iotek.tn-cdn.net

# Enable R2 Storage Mode
STORAGE_MODE=r2
```

### 2. Optional Debug Variables

```bash
# Snapshot Debug Mode (optional - tắt trên production)
DEBUG_SNAPSHOT=0

# Snapshot Fallback (optional)
SNAPSHOT_FALLBACK_UDP=1

# Fake Snapshot Size (cho development testing)
FAKE_SNAPSHOT_SIZE=800x600
```

### 3. Recording Configuration

```bash
# Recording Directory (tạm thời trước khi upload lên R2)
# Trên Coolify nên dùng /tmp vì có permission
RECORD_DIR=/tmp

# Fake Recording Settings (cho testing - tắt trên production)
FAKE_RECORD_SIZE=1280x720
FAKE_RECORD_FPS=15
FAKE_RECORD_CODEC=libx264
FAKE_RECORD_QUALITY=23
FAKE_RECORD_REALTIME=0
```

## 🚀 Các bước Setup trên Coolify

### Bước 1: Truy cập Coolify Dashboard

1. Login vào Coolify: https://your-coolify-domain.com
2. Chọn project/service của Camera API
3. Vào tab **Environment Variables**

### Bước 2: Thêm R2 Environment Variables

**Trong Coolify UI, thêm các biến sau:**

| Key | Value | Description |
|-----|-------|-------------|
| `R2_ENDPOINT` | `https://a1000a80a775f57fe92ea14196486a3a.r2.cloudflarestorage.com` | R2 API endpoint |
| `R2_ACCESS_KEY_ID` | `0c10ee4c19fe892894a9c5311798a69c` | R2 Access Key |
| `R2_SECRET_ACCESS_KEY` | `20db186ea3ebb14ba05254a9b82b1f033fef297335ab8d4e7874e90634ca36bb` | R2 Secret Key |
| `R2_BUCKET_NAME` | `iotek` | R2 Bucket name |
| `R2_PUBLIC_URL` | `https://iotek.tn-cdn.net` | R2 Public URL |
| `STORAGE_MODE` | `r2` | Enable R2 storage |
| `RECORD_DIR` | `/tmp` | Temp directory (Linux path) |
| `SNAPSHOT_DIR` | `/tmp` | Snapshot temp dir (Linux path) |

### Bước 3: Database Configuration (đã có sẵn)

```bash
# Coolify sử dụng DATABASE_URL format
DATABASE_URL=postgres://postgres:admin@nco8w4ccgskss8ccgwg0ggk4:5432/Camera_api
```

**Lưu ý:** Không cần set `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` riêng lẻ khi đã có `DATABASE_URL`.

### Bước 4: Production-specific Settings

```bash
# JWT Secret (dùng secret mạnh hơn cho production)
JWT_SECRET=your_production_secret_key_here

# Stream Base URL (production domain)
STREAM_BASE_URL=https://your-production-domain.com/live

# Port (Coolify thường auto-detect)
PORT=3000
HOST=0.0.0.0

# Debug Mode - TẮT trên production
DEBUG_SNAPSHOT=0
PTZ_THROTTLE_DEBUG=0
REFRESH_DEBUG=0

# PTZ Configuration
PTZ_THROTTLE_MS=300
PTZ_USE_ONVIF=0
```

## 📝 Template Environment Variables cho Coolify

Copy và paste vào Coolify Environment Variables:

```bash
# Database (Coolify format)
DATABASE_URL=postgres://postgres:admin@nco8w4ccgskss8ccgwg0ggk4:5432/Camera_api

# Server
PORT=3000
HOST=0.0.0.0
JWT_SECRET=production_secret_key_change_this

# Stream
STREAM_BASE_URL=https://your-production-domain.com/live

# R2 Storage Configuration
R2_ENDPOINT=https://a1000a80a775f57fe92ea14196486a3a.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=0c10ee4c19fe892894a9c5311798a69c
R2_SECRET_ACCESS_KEY=20db186ea3ebb14ba05254a9b82b1f033fef297335ab8d4e7874e90634ca36bb
R2_BUCKET_NAME=iotek
R2_PUBLIC_URL=https://iotek.tn-cdn.net
STORAGE_MODE=r2

# Directories (Linux paths)
RECORD_DIR=/tmp
SNAPSHOT_DIR=/tmp

# Production Settings (disable debug)
DEBUG_SNAPSHOT=0
PTZ_THROTTLE_DEBUG=0
REFRESH_DEBUG=0
SNAPSHOT_FALLBACK_UDP=1

# PTZ
PTZ_THROTTLE_MS=300
PTZ_USE_ONVIF=0

# Recording Settings
FAKE_RECORD_SIZE=1280x720
FAKE_RECORD_FPS=15
FAKE_RECORD_CODEC=libx264
FAKE_RECORD_QUALITY=23
FAKE_RECORD_REALTIME=0
```

## ⚠️ Lưu ý quan trọng

### 1. File Paths khác nhau giữa Windows và Linux

**Local Development (Windows):**
```bash
RECORD_DIR=C:\\tmp
SNAPSHOT_DIR=C:\\tmp
```

**Production Coolify (Linux):**
```bash
RECORD_DIR=/tmp
SNAPSHOT_DIR=/tmp
```

### 2. R2 Credentials Security

- ✅ **Trên Coolify**: Sử dụng Environment Variables (secure)
- ❌ **KHÔNG** commit credentials vào Git
- ✅ Có thể sử dụng Coolify Secrets cho sensitive data

### 3. R2 Public URL

Có 2 options:

**Option 1: R2.dev Subdomain (Free)**
```bash
R2_PUBLIC_URL=https://pub-abc123xyz.r2.dev
```

**Option 2: Custom Domain (Recommended cho production)**
```bash
R2_PUBLIC_URL=https://iotek.tn-cdn.net
```

Để setup custom domain:
1. Vào Cloudflare Dashboard → R2 → Buckets → iotek → Settings
2. Custom Domains → Add custom domain
3. Nhập: `iotek.tn-cdn.net`
4. Cloudflare sẽ tự động setup DNS

### 4. Database URL Format

Coolify sử dụng format:
```
postgres://[user]:[password]@[host]:[port]/[database]
```

Container name trong Coolify (vd: `nco8w4ccgskss8ccgwg0ggk4`) sẽ resolve thành internal IP.

## 🔍 Verify Setup sau khi Deploy

### 1. Check Logs
```bash
# Trong Coolify Logs, tìm dòng:
[NestFactory] Starting Nest application...
[StorageService] StorageService initialized - Mode: r2, Bucket: iotek
```

### 2. Test Snapshot Upload

```bash
# POST /snapshots/capture
curl -X POST https://your-production-domain.com/snapshots/capture \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "cameraId": "your-camera-id",
    "strategy": "FAKE"
  }'
```

Response sẽ chứa R2 URL:
```json
{
  "id": "...",
  "storage_path": "https://iotek.tn-cdn.net/snapshots/camera-id/timestamp-file.jpg",
  "strategy": "FAKE"
}
```

### 3. Verify File trên R2

1. Vào Cloudflare Dashboard → R2 → Buckets → iotek
2. Browse folders: `snapshots/` và `recordings/`
3. Xem files đã được upload

## 🎯 Checklist Setup

- [ ] Add tất cả R2 environment variables vào Coolify
- [ ] Đổi `RECORD_DIR` và `SNAPSHOT_DIR` thành Linux paths (`/tmp`)
- [ ] Verify `DATABASE_URL` format đúng
- [ ] Set `JWT_SECRET` mạnh cho production
- [ ] Set `DEBUG_SNAPSHOT=0` (tắt debug)
- [ ] Verify `R2_PUBLIC_URL` đã được setup trên Cloudflare
- [ ] Test custom domain `iotek.tn-cdn.net` hoạt động
- [ ] Deploy lại service trên Coolify
- [ ] Check logs confirm R2 initialized
- [ ] Test snapshot upload
- [ ] Verify file xuất hiện trên R2 bucket

## 📚 Tài liệu tham khảo

- [Cloudflare R2 Documentation](https://developers.cloudflare.com/r2/)
- [R2 Custom Domains](https://developers.cloudflare.com/r2/buckets/public-buckets/#custom-domains)
- Project docs: `docs/R2-STORAGE.md`
- Deployment checklist: `DEPLOYMENT-CHECKLIST.md`

## 🆘 Troubleshooting

### Lỗi: "R2 endpoint undefined"
- Kiểm tra `R2_ENDPOINT` đã được set trong Coolify
- Restart service sau khi thêm env vars

### Lỗi: "Access Denied" khi upload
- Verify `R2_ACCESS_KEY_ID` và `R2_SECRET_ACCESS_KEY` đúng
- Check permissions của API token trên Cloudflare

### URL không mở được
- Verify custom domain đã được setup trên Cloudflare R2
- Test với R2.dev subdomain trước
- Check DNS đã propagate (dùng `nslookup iotek.tn-cdn.net`)

### Files upload nhưng không thấy trên bucket
- Check bucket name đúng (`iotek`)
- Verify region của R2 endpoint match với bucket
- Check logs có message "Successfully uploaded to R2"
