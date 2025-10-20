# 📝 Summary: R2 Storage Setup hoàn tất

## ✅ Đã hoàn thành

### 1. R2 Integration Code
- ✅ `src/modules/storage/storage.module.ts` - StorageModule
- ✅ `src/modules/storage/storage.service.ts` - R2 upload/download service
- ✅ `src/modules/snapshot/snapshot.service.ts` - Upload snapshots to R2
- ✅ `src/modules/recording/recording.service.ts` - Upload recordings to R2

### 2. Local Environment Setup
- ✅ `.env` - R2 credentials configured
- ✅ `R2_PUBLIC_URL=https://iotek.tn-cdn.net` - Custom domain set
- ✅ Server running successfully with R2 enabled

### 3. Production Documentation
- ✅ `docs/COOLIFY-R2-SETUP.md` - Chi tiết đầy đủ setup R2 trên Coolify
- ✅ `.env.production.example` - Template với R2 variables
- ✅ `DEPLOYMENT-CHECKLIST.md` - Updated với R2 setup
- ✅ `COOLIFY-R2-QUICK-SETUP.md` - Quick reference card

## 🎯 Workflow hoạt động

### Snapshot Flow
```
Client Request 
  → POST /snapshots/capture
  → FFmpeg capture từ camera
  → Save temp file to C:\tmp (local) or /tmp (production)
  → Upload to R2: snapshots/{cameraId}/{timestamp}.jpg
  → Get R2 public URL: https://iotek.tn-cdn.net/snapshots/...
  → Save URL to database
  → Delete temp file
  → Return response with R2 URL
```

### Recording Flow
```
Client Request
  → POST /recordings/start
  → FFmpeg start recording
  → Save temp file to C:\tmp or /tmp
  → On stop: Upload to R2: recordings/{cameraId}/{timestamp}.mp4
  → Get R2 public URL: https://iotek.tn-cdn.net/recordings/...
  → Save URL to database
  → Delete temp file
  → Return response with R2 URL
```

## 🔑 Environment Variables Setup

### Local Development (Windows)
```env
R2_ENDPOINT=https://a1000a80a775f57fe92ea14196486a3a.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=0c10ee4c19fe892894a9c5311798a69c
R2_SECRET_ACCESS_KEY=20db186ea3ebb14ba05254a9b82b1f033fef297335ab8d4e7874e90634ca36bb
R2_BUCKET_NAME=iotek
R2_PUBLIC_URL=https://iotek.tn-cdn.net
STORAGE_MODE=r2
RECORD_DIR=C:\\tmp
SNAPSHOT_DIR=C:\\tmp
DEBUG_SNAPSHOT=1
```

### Coolify Production (Linux)
```env
R2_ENDPOINT=https://a1000a80a775f57fe92ea14196486a3a.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=0c10ee4c19fe892894a9c5311798a69c
R2_SECRET_ACCESS_KEY=20db186ea3ebb14ba05254a9b82b1f033fef297335ab8d4e7874e90634ca36bb
R2_BUCKET_NAME=iotek
R2_PUBLIC_URL=https://iotek.tn-cdn.net
STORAGE_MODE=r2
RECORD_DIR=/tmp
SNAPSHOT_DIR=/tmp
DEBUG_SNAPSHOT=0
DATABASE_URL=postgres://postgres:admin@container:5432/Camera_api
JWT_SECRET=production_secret
STREAM_BASE_URL=https://your-domain.com/live
```

## ⚠️ Sự khác biệt Local vs Production

| Aspect | Local (Windows) | Production (Coolify/Linux) |
|--------|----------------|---------------------------|
| **Paths** | `C:\\tmp` | `/tmp` |
| **Database** | Individual vars (DB_HOST, etc.) | `DATABASE_URL` only |
| **Debug** | `DEBUG_SNAPSHOT=1` | `DEBUG_SNAPSHOT=0` |
| **JWT** | `dev_secret` | Strong secret |
| **Stream URL** | `localhost:8080` | Production domain |

## 📚 Tài liệu tham khảo

### Cho Developer
- `docs/R2-STORAGE.md` - R2 integration overview
- `docs/SNAPSHOT.md` - Snapshot service documentation
- `docs/RECORDING.md` - Recording service documentation

### Cho DevOps/Deployment
- `docs/COOLIFY-R2-SETUP.md` - **Chi tiết setup R2 trên Coolify**
- `COOLIFY-R2-QUICK-SETUP.md` - **Quick reference card**
- `.env.production.example` - Production environment template
- `DEPLOYMENT-CHECKLIST.md` - Deployment checklist with R2

### Troubleshooting
- `docs/HOW-TO-CHECK-R2-FILES.md` - Verify files on R2
- Server logs: `[StorageService]` prefix

## 🎯 Next Steps cho Production

### 1. Verify Cloudflare R2 Setup
- [ ] Custom domain `iotek.tn-cdn.net` đã được add vào R2 bucket
- [ ] Public access đã enabled
- [ ] DNS đã propagate (test: `nslookup iotek.tn-cdn.net`)

### 2. Copy Environment Variables vào Coolify
- [ ] Open Coolify Dashboard → Service → Environment Variables
- [ ] Copy template từ `COOLIFY-R2-QUICK-SETUP.md`
- [ ] Thay đổi:
  - `DATABASE_URL` → Coolify container name
  - `JWT_SECRET` → Production secret
  - `STREAM_BASE_URL` → Production domain

### 3. Deploy & Test
- [ ] Save environment variables
- [ ] Redeploy service
- [ ] Check logs: `[StorageService] initialized - Mode: r2`
- [ ] Test snapshot upload: POST /snapshots/capture
- [ ] Verify response có R2 URL: `https://iotek.tn-cdn.net/...`
- [ ] Open URL trong browser → Should show image
- [ ] Check Cloudflare Dashboard → R2 → Bucket → Files exist

## ✨ Features

### ✅ Implemented
- Upload snapshots to R2
- Upload recordings to R2
- Public URL generation
- Automatic temp file cleanup
- Error handling & retry logic
- Support both FAKE and RTSP strategies
- Database integration (store R2 URLs)

### 🔄 Workflow Benefits
- **No local storage needed** - Files uploaded to cloud
- **Scalable** - R2 handles storage & bandwidth
- **CDN-ready** - Custom domain with CDN
- **Cost-effective** - R2 pricing better than S3
- **Automatic cleanup** - Temp files deleted after upload

## 🎉 Kết luận

**R2 Storage Integration hoàn tất!**

- ✅ Code implemented & tested
- ✅ Local development working
- ✅ Production documentation ready
- ✅ Environment variables configured
- ✅ Ready to deploy on Coolify

**Files uploaded to:**
```
https://iotek.tn-cdn.net/snapshots/{cameraId}/{timestamp}.jpg
https://iotek.tn-cdn.net/recordings/{cameraId}/{timestamp}.mp4
```

**Chỉ cần:**
1. Copy env vars vào Coolify
2. Deploy
3. Test snapshot/recording
4. Done! 🚀
