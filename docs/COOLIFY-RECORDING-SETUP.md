# Coolify Production Setup - Recording với R2

## 🎯 Mục đích

Hướng dẫn setup environment variables trên Coolify production cho tính năng Recording với Cloudflare R2 storage.

## 📋 Prerequisites

- ✅ Coolify project đã deploy
- ✅ Cloudflare R2 bucket đã tạo (bucket name: `iotek`)
- ✅ R2 API credentials đã có
- ✅ Custom domain đã setup (optional): `https://iotek.tn-cdn.net`

## 🔧 Environment Variables Setup

### Bước 1: Truy cập Coolify Dashboard

1. Login vào Coolify: `https://your-coolify-domain.com`
2. Chọn project Camera API
3. Click tab **"Environment Variables"**

### Bước 2: Thêm R2 Configuration Variables

Add các environment variables sau:

#### **Storage Mode**
```bash
STORAGE_MODE=r2
```
- **Mô tả**: Enable R2 cloud storage (thay vì local filesystem)
- **Bắt buộc**: YES
- **Value**: `r2`

#### **R2 Endpoint**
```bash
R2_ENDPOINT=https://a1000a80a775f57fe92ea14196486a3a.r2.cloudflarestorage.com
```
- **Mô tả**: R2 API endpoint (from Cloudflare dashboard)
- **Bắt buộc**: YES
- **Lưu ý**: Lấy từ Cloudflare R2 → Settings → Endpoint

#### **R2 Access Key ID**
```bash
R2_ACCESS_KEY_ID=0c10ee4c19fe892894a9c5311798a69c
```
- **Mô tả**: R2 API access key
- **Bắt buộc**: YES
- **Security**: Mark as **secret** trong Coolify
- **Lưu ý**: Lấy từ Cloudflare R2 → Manage R2 API Tokens

#### **R2 Secret Access Key**
```bash
R2_SECRET_ACCESS_KEY=20db186ea3ebb14ba05254a9b82b1f033fef297335ab8d4e7874e90634ca36bb
```
- **Mô tả**: R2 API secret key
- **Bắt buộc**: YES
- **Security**: Mark as **secret** trong Coolify
- **Lưu ý**: Lấy từ Cloudflare R2 → Manage R2 API Tokens

#### **R2 Bucket Name**
```bash
R2_BUCKET_NAME=iotek
```
- **Mô tả**: Tên R2 bucket để lưu files
- **Bắt buộc**: YES
- **Value**: `iotek`

#### **R2 Public URL (Custom Domain)**
```bash
R2_PUBLIC_URL=https://iotek.tn-cdn.net
```
- **Mô tả**: Custom domain cho R2 bucket (optional nhưng recommended)
- **Bắt buộc**: NO (fallback to endpoint)
- **Benefits**: 
  - Shorter URLs
  - Custom branding
  - CDN caching

#### **Recording Directory (Optional)**
```bash
RECORD_DIR=/tmp
```
- **Mô tả**: Temp directory cho local recording files (before upload to R2)
- **Bắt buộc**: NO (default: system temp dir)
- **Linux**: `/tmp`
- **Windows**: Để trống hoặc `C:\tmp`

#### **Debug Recording (Optional)**
```bash
DEBUG_RECORDING=1
```
- **Mô tả**: Enable detailed FFmpeg logs
- **Bắt buộc**: NO
- **Value**: `1` để enable, bỏ trống để disable
- **Use case**: Debugging recording issues

### Bước 3: Verify Environment Variables

Sau khi add, kiểm tra lại:

```
✅ STORAGE_MODE=r2
✅ R2_ENDPOINT=https://a1000a80a775f57fe92ea14196486a3a.r2.cloudflarestorage.com
✅ R2_ACCESS_KEY_ID=******** (hidden)
✅ R2_SECRET_ACCESS_KEY=******** (hidden)
✅ R2_BUCKET_NAME=iotek
✅ R2_PUBLIC_URL=https://iotek.tn-cdn.net
```

### Bước 4: Redeploy Application

1. Click **"Redeploy"** button trên Coolify
2. Chọn **"Force rebuild"** (optional)
3. Đợi deployment hoàn tất (~2-5 phút)

### Bước 5: Check Logs

Sau khi deploy, check logs để verify:

```bash
# Should see this log on startup:
[Nest] LOG [StorageService] StorageService initialized - Mode: r2, Bucket: iotek
```

**Nếu thấy log này → R2 đã được config đúng! ✅**

## 🧪 Testing trên Production

### 1. Test Snapshot (FAKE strategy)

```bash
POST https://your-api-domain.com/snapshots/capture
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "cameraId": "your-camera-id",
  "strategy": "FAKE"
}
```

**Expected Response:**
```json
{
  "id": "...",
  "storagePath": "https://iotek.tn-cdn.net/snapshots/...",
  "capturedAt": "2025-10-20T..."
}
```

✅ `storagePath` phải là R2 URL, KHÔNG phải local path!

### 2. Test Recording (FAKE strategy)

```bash
POST https://your-api-domain.com/recordings/start
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "cameraId": "your-camera-id",
  "durationSec": 10,
  "strategy": "FAKE"
}
```

**Expected Response:**
```json
{
  "id": "...",
  "status": "RUNNING",
  "strategy": "FAKE"
  // No storagePath exposed initially
}
```

Sau 10 giây, GET recording:

```bash
GET https://your-api-domain.com/recordings/{id}
Authorization: Bearer YOUR_JWT_TOKEN
```

**Expected Response:**
```json
{
  "id": "...",
  "status": "COMPLETED",
  "storagePath": "https://iotek.tn-cdn.net/recordings/...",
  "durationSec": 10
}
```

✅ `storagePath` phải là R2 URL!

### 3. Test Recording (RTSP với camera thật)

```bash
POST https://your-api-domain.com/recordings/start
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "cameraId": "real-camera-id",
  "durationSec": 5,
  "strategy": "RTSP"
}
```

Check status sau 5-10 giây:

```bash
GET https://your-api-domain.com/recordings/{id}
```

**Expected:** `status: "COMPLETED"` và `storagePath` là R2 URL

## 🔍 Troubleshooting

### Issue 1: Files vẫn lưu local path

**Symptom:**
```json
{
  "storagePath": "/tmp/xyz.mp4"  // Local path
}
```

**Solution:**
1. Check `STORAGE_MODE=r2` trong environment variables
2. Restart service: Click "Redeploy" trên Coolify
3. Check logs: `[StorageService] StorageService initialized - Mode: r2`

### Issue 2: R2 upload failed

**Symptom trong logs:**
```
[RECORDING] R2 upload failed, keeping local file
```

**Solution:**
1. Verify R2 credentials đúng
2. Check R2 bucket name: `iotek`
3. Test credentials với AWS CLI hoặc Cloudflare dashboard
4. Check network connectivity từ production server

### Issue 3: Recording status = FAILED

**Symptom:**
```json
{
  "status": "FAILED",
  "errorMessage": "FFMPEG_TIMEOUT_code=1..."
}
```

**Solution:**
1. Check camera RTSP URL trong database
2. Verify camera network connectivity từ production server
3. Check FFmpeg installed: `ffmpeg -version`
4. Enable debug: `DEBUG_RECORDING=1`

### Issue 4: Custom domain không work

**Symptom:**
```json
{
  "storagePath": "https://a1000...r2.cloudflarestorage.com/..."
  // Not using custom domain
}
```

**Solution:**
1. Verify `R2_PUBLIC_URL=https://iotek.tn-cdn.net`
2. Redeploy service
3. Check logs startup: Should use custom domain

## 📊 Database Migration

Nếu deploy lần đầu hoặc update từ version cũ:

### Check migration status:

```bash
# SSH vào production server
cd /path/to/camera-api

# Run migrations
npm run migration:run
```

**Expected output:**
```
Migration AddRecordingColumns1729400000000 has been executed successfully.
```

### Verify database schema:

```sql
-- Connect to production database
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'recordings';
```

**Expected columns:**
- ✅ `duration_sec` (integer)
- ✅ `error_message` (varchar)
- ✅ `strategy` (varchar)
- ✅ `storage_path` (varchar)
- ✅ `status` (varchar)

## 🎯 Production Checklist

Trước khi release production:

- [ ] ✅ All environment variables added
- [ ] ✅ Credentials marked as **secret**
- [ ] ✅ Application redeployed successfully
- [ ] ✅ Logs show `Mode: r2`
- [ ] ✅ Database migration executed
- [ ] ✅ Snapshot test passed (FAKE strategy)
- [ ] ✅ Recording test passed (FAKE strategy)
- [ ] ✅ Recording test passed (RTSP với camera thật)
- [ ] ✅ R2 URLs accessible in browser
- [ ] ✅ Download working correctly
- [ ] ✅ No local paths exposed in API responses

## 📝 Environment Variables Summary

| Variable | Value | Required | Secret |
|----------|-------|----------|--------|
| `STORAGE_MODE` | `r2` | ✅ YES | ❌ NO |
| `R2_ENDPOINT` | `https://a1000...r2.cloudflarestorage.com` | ✅ YES | ❌ NO |
| `R2_ACCESS_KEY_ID` | `0c10ee4c...` | ✅ YES | ✅ YES |
| `R2_SECRET_ACCESS_KEY` | `20db186ea...` | ✅ YES | ✅ YES |
| `R2_BUCKET_NAME` | `iotek` | ✅ YES | ❌ NO |
| `R2_PUBLIC_URL` | `https://iotek.tn-cdn.net` | ⚠️ Recommended | ❌ NO |
| `RECORD_DIR` | `/tmp` | ❌ NO | ❌ NO |
| `DEBUG_RECORDING` | `1` | ❌ NO | ❌ NO |

## 🚀 Post-Deployment

Sau khi deploy xong:

1. **Verify R2 Bucket:**
   - Login Cloudflare Dashboard
   - R2 → Bucket `iotek`
   - Browse `snapshots/` và `recordings/` folders
   - Check files uploaded successfully

2. **Monitor Logs:**
   - Check Coolify logs cho errors
   - Look for R2 upload success messages
   - Monitor FFmpeg errors

3. **Performance:**
   - Test download speed từ R2 URLs
   - Verify CDN caching working
   - Check bandwidth usage trên Cloudflare

## 🔗 Related Documentation

- **R2 Setup Guide**: `docs/R2-QUICKSTART.md`
- **R2 Storage Details**: `docs/R2-STORAGE.md`
- **Recording Fix**: `docs/FIX-RECORDING-R2-STORAGE.md`
- **FFmpeg Fix**: `docs/FIX-FFMPEG-STIMEOUT.md`
- **Response Transform**: `docs/FIX-RECORDING-RESPONSE.md`

## 💡 Tips

1. **Security**: Always mark credentials as **secret** trong Coolify
2. **Monitoring**: Enable `DEBUG_RECORDING=1` khi troubleshoot
3. **Backup**: R2 có versioning - enable nếu cần rollback
4. **Cost**: Monitor R2 storage usage và bandwidth
5. **CDN**: Custom domain giúp cache tốt hơn

---

**Last Updated:** October 20, 2025  
**Version:** 1.0.0  
**Status:** ✅ Production Ready
