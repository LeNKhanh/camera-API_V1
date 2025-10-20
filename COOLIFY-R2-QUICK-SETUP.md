# 🚀 Quick Setup Guide: R2 trên Coolify Production

## TL;DR - Các bước nhanh

### 1️⃣ Copy Environment Variables vào Coolify

**Login vào Coolify → Project → Service → Environment Variables → Paste:**

```bash
# === R2 Storage ===
R2_ENDPOINT=https://a1000a80a775f57fe92ea14196486a3a.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=0c10ee4c19fe892894a9c5311798a69c
R2_SECRET_ACCESS_KEY=20db186ea3ebb14ba05254a9b82b1f033fef297335ab8d4e7874e90634ca36bb
R2_BUCKET_NAME=iotek
R2_PUBLIC_URL=https://iotek.tn-cdn.net
STORAGE_MODE=r2

# === Database ===
DATABASE_URL=postgres://postgres:admin@your-db-container:5432/Camera_api

# === Server ===
PORT=3000
HOST=0.0.0.0
JWT_SECRET=production_secret_key_change_this
STREAM_BASE_URL=https://your-production-domain.com/live

# === Linux Paths ===
RECORD_DIR=/tmp
SNAPSHOT_DIR=/tmp

# === Production (disable debug) ===
DEBUG_SNAPSHOT=0
PTZ_THROTTLE_DEBUG=0
REFRESH_DEBUG=0

# === PTZ ===
PTZ_THROTTLE_MS=300
PTZ_USE_ONVIF=0

# === Recording ===
SNAPSHOT_FALLBACK_UDP=1
FAKE_RECORD_SIZE=1280x720
FAKE_RECORD_FPS=15
FAKE_RECORD_CODEC=libx264
FAKE_RECORD_QUALITY=23
FAKE_RECORD_REALTIME=0
```

### 2️⃣ Thay đổi các giá trị sau:

- `DATABASE_URL` → Container name từ Coolify
- `JWT_SECRET` → Secret key mạnh (generate random)
- `STREAM_BASE_URL` → Production domain của bạn

### 3️⃣ Save & Redeploy

Click **"Save"** → **"Redeploy"** service

### 4️⃣ Verify Logs

Check deployment logs, tìm dòng:
```
[StorageService] StorageService initialized - Mode: r2, Bucket: iotek
```

## ⚠️ Lưu ý quan trọng

### Windows vs Linux Paths

| Environment | RECORD_DIR | SNAPSHOT_DIR |
|------------|------------|--------------|
| **Local (Windows)** | `C:\\tmp` | `C:\\tmp` |
| **Coolify (Linux)** | `/tmp` | `/tmp` |

### Database Config

- **Local**: Dùng `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
- **Coolify**: CHỈ dùng `DATABASE_URL` (bỏ các biến riêng lẻ)

### Debug Mode

| Variable | Local | Production |
|----------|-------|------------|
| `DEBUG_SNAPSHOT` | `1` | `0` |
| `PTZ_THROTTLE_DEBUG` | `1` | `0` |
| `REFRESH_DEBUG` | `1` | `0` |

## ✅ Checklist Deploy

- [ ] Add tất cả R2 env vars vào Coolify
- [ ] Đổi paths thành Linux format (`/tmp`)
- [ ] Set `DATABASE_URL` đúng container name
- [ ] Change `JWT_SECRET` sang production key
- [ ] Update `STREAM_BASE_URL` với domain thực
- [ ] Tắt debug modes (`DEBUG_SNAPSHOT=0`)
- [ ] Save & Redeploy
- [ ] Check logs xác nhận R2 initialized
- [ ] Test snapshot upload
- [ ] Verify file trên R2 bucket

## 🔗 Tài liệu đầy đủ

📖 **Chi tiết:** `docs/COOLIFY-R2-SETUP.md`

## 🆘 Troubleshooting nhanh

### ❌ "R2 endpoint undefined"
→ Kiểm tra `R2_ENDPOINT` đã set trong Coolify

### ❌ "Access Denied"
→ Verify `R2_ACCESS_KEY_ID` và `R2_SECRET_ACCESS_KEY` đúng

### ❌ URL không mở được
→ Verify custom domain `iotek.tn-cdn.net` đã setup trên Cloudflare R2

### ❌ Files không thấy trên bucket
→ Check logs có "Successfully uploaded to R2"

## 🎯 Test sau khi deploy

```bash
# Capture snapshot
curl -X POST https://your-domain.com/snapshots/capture \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"cameraId": "camera-id", "strategy": "FAKE"}'

# Response nên có:
{
  "storage_path": "https://iotek.tn-cdn.net/snapshots/..."
}
```

## 📊 Expected Logs

```
[NestFactory] Starting Nest application...
[StorageService] StorageService initialized - Mode: r2, Bucket: iotek
[InstanceLoader] StorageModule dependencies initialized
...
[NestApplication] Nest application successfully started
Camera API listening on http://localhost:3000
```

---

**Done!** R2 storage ready trên production 🎉
