# Cloudflare R2 Storage Integration

## Tổng Quan

Project đã tích hợp **Cloudflare R2** để lưu trữ snapshot và recording files trên cloud thay vì local filesystem. Điều này giải quyết vấn đề:
- ✅ Files mất khi container restart (ephemeral `/tmp/` storage)
- ✅ Persistent storage với high availability
- ✅ Scalable - không giới hạn dung lượng disk
- ✅ S3-compatible API - dễ migration

---

## Kiến Trúc

### Storage Module

Tạo module riêng `StorageModule` với `StorageService` để quản lý việc upload/download files:

**Files:**
- `src/modules/storage/storage.module.ts` - Module definition
- `src/modules/storage/storage.service.ts` - R2 upload/download logic

**Tính năng:**
- `uploadFile(localPath, r2Key)` - Upload file từ local lên R2, trả về public URL
- `downloadFile(r2Key)` - Download file từ R2 về dạng stream (cho proxy mode)
- `deleteFile(r2Key)` - Xóa file trên R2
- `isR2Url(path)` - Kiểm tra path có phải R2 URL không
- `extractR2Key(url)` - Extract R2 key từ URL

### Workflow

#### Snapshot Capture Flow

```
┌─────────────┐
│  API Call   │
│  /snapshot  │
└──────┬──────┘
       │
       ▼
┌──────────────────────┐
│  FFmpeg Capture      │
│  → /tmp/uuid.jpg     │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐    STORAGE_MODE=r2?
│  Upload to R2        │───────────┐
│  snapshots/cam1/...  │           │
└──────┬───────────────┘           │ No → Skip
       │ Yes                       │
       ▼                           ▼
┌──────────────────────┐    ┌─────────────┐
│  Get R2 Public URL   │    │  Keep Local │
│  https://r2.../...   │    │  /tmp/...   │
└──────┬───────────────┘    └──────┬──────┘
       │                            │
       ▼                            ▼
┌──────────────────────┐    ┌─────────────┐
│  Delete Local Temp   │    │  Save DB    │
│  /tmp/uuid.jpg       │    │  w/ local   │
└──────┬───────────────┘    └─────────────┘
       │
       ▼
┌──────────────────────┐
│  Save DB Record      │
│  storagePath=R2_URL  │
└──────────────────────┘
```

#### Recording Flow

```
┌─────────────┐
│  API Call   │
│  /start     │
└──────┬──────┘
       │
       ▼
┌──────────────────────┐
│  Create DB Record    │
│  status=PENDING      │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│  FFmpeg Record       │
│  → /tmp/uuid.mp4     │
│  status=RUNNING      │
└──────┬───────────────┘
       │ (duration expires)
       ▼
┌──────────────────────┐
│  FFmpeg Completes    │
│  on('close')         │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐    STORAGE_MODE=r2?
│  Upload to R2        │───────────┐
│  recordings/cam1/... │           │
└──────┬───────────────┘           │ No → Skip
       │ Yes                       │
       ▼                           ▼
┌──────────────────────┐    ┌─────────────┐
│  Get R2 Public URL   │    │  Keep Local │
│  https://r2.../...   │    │  /tmp/...   │
└──────┬───────────────┘    └──────┬──────┘
       │                            │
       ▼                            ▼
┌──────────────────────┐    ┌─────────────┐
│  Delete Local Temp   │    │  Update DB  │
│  /tmp/uuid.mp4       │    │  w/ local   │
└──────┬───────────────┘    └─────────────┘
       │
       ▼
┌──────────────────────┐
│  Update DB Record    │
│  storagePath=R2_URL  │
│  status=COMPLETED    │
└──────────────────────┘
```

---

## Cấu Hình

### Environment Variables

Thêm vào `.env` (local) và Coolify environment variables (production):

```bash
# Cloudflare R2 Storage Configuration
R2_ENDPOINT=https://a1000a80a775f57fe92ea14196486a3a.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=0c10ee4c19fe892894a9c5311798a69c
R2_SECRET_ACCESS_KEY=20db186ea3ebb14ba05254a9b82b1f033fef297335ab8d4e7874e90634ca36bb
R2_BUCKET_NAME=iotek

# Public URL (optional - nếu có custom domain cho R2 bucket)
R2_PUBLIC_URL=https://pub-your-r2-domain.r2.dev

# Storage mode: 'r2' hoặc 'local'
STORAGE_MODE=r2
```

### Coolify Deployment

**Bước 1:** Vào Coolify dashboard → Service → Environment Variables

**Bước 2:** Thêm các biến:
```
R2_ENDPOINT=https://a1000a80a775f57fe92ea14196486a3a.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=0c10ee4c19fe892894a9c5311798a69c
R2_SECRET_ACCESS_KEY=20db186ea3ebb14ba05254a9b82b1f033fef297335ab8d4e7874e90634ca36bb
R2_BUCKET_NAME=iotek
STORAGE_MODE=r2
```

**Bước 3:** Redeploy service

---

## Database Schema

**Không cần migration** - chỉ thay đổi giá trị của column `storage_path`:

### Snapshots Table

```sql
CREATE TABLE snapshots (
  id uuid PRIMARY KEY,
  camera_id uuid REFERENCES cameras(id),
  storage_path varchar(500) NOT NULL, -- Lưu R2 URL hoặc local path
  captured_at timestamptz NOT NULL DEFAULT now()
);
```

**Ví dụ:**
- **Local mode**: `/tmp/snapshot_abc123.jpg`
- **R2 mode**: `https://a1000a80a775f57fe92ea14196486a3a.r2.cloudflarestorage.com/iotek/snapshots/cam1/1729440000000-abc123.jpg`

### Recordings Table

```sql
CREATE TABLE recordings (
  id uuid PRIMARY KEY,
  camera_id uuid REFERENCES cameras(id),
  storage_path varchar(500) NOT NULL, -- Lưu R2 URL hoặc local path
  duration_sec int NOT NULL,
  status varchar(20) NOT NULL,
  started_at timestamptz NOT NULL,
  ended_at timestamptz
);
```

**Ví dụ:**
- **Local mode**: `/tmp/recording_xyz789.mp4`
- **R2 mode**: `https://a1000a80a775f57fe92ea14196486a3a.r2.cloudflarestorage.com/iotek/recordings/cam1/1729440000000-xyz789.mp4`

---

## R2 Key Structure

Files được tổ chức theo cấu trúc:

```
iotek/                           # Bucket root
├── snapshots/
│   ├── cam1/
│   │   ├── 1729440000000-abc123.jpg
│   │   ├── 1729440123456-def456.jpg
│   │   └── ...
│   ├── cam2/
│   │   └── ...
│   └── ...
└── recordings/
    ├── cam1/
    │   ├── 1729440000000-xyz789.mp4
    │   ├── 1729440234567-uvw012.mp4
    │   └── ...
    ├── cam2/
    │   └── ...
    └── ...
```

**Format:**
- Snapshots: `snapshots/{cameraId}/{timestamp}-{filename}.jpg`
- Recordings: `recordings/{cameraId}/{timestamp}-{filename}.mp4`

---

## API Behavior

### Snapshot API

**Capture:**
```bash
POST /snapshots/capture
{
  "cameraId": "cam1",
  "strategy": "RTSP"  # hoặc "FAKE" để test
}
```

**Response:**
```json
{
  "id": "abc-123",
  "cameraId": "cam1",
  "storagePath": "https://r2.../snapshots/cam1/1729440000000-abc123.jpg",
  "capturedAt": "2024-10-20T10:00:00Z"
}
```

### Recording API

**Start Recording:**
```bash
POST /recordings/start
{
  "cameraId": "cam1",
  "durationSec": 30
}
```

**Response:**
```json
{
  "id": "xyz-789",
  "storagePath": "/tmp/xyz-789.mp4",  # Tạm thời local path
  "status": "RUNNING"
}
```

**Get Recording (sau khi complete):**
```bash
GET /recordings/xyz-789
```

**Response:**
```json
{
  "id": "xyz-789",
  "cameraId": "cam1",
  "storagePath": "https://r2.../recordings/cam1/1729440000000-xyz789.mp4",
  "status": "COMPLETED",
  "startedAt": "2024-10-20T10:00:00Z",
  "endedAt": "2024-10-20T10:00:30Z"
}
```

**Download Recording:**
```bash
GET /recordings/xyz-789/download
```

- **R2 mode**: Redirect 302 đến R2 public URL
- **Local mode**: Stream file từ server (`res.sendFile()`)

---

## Error Handling & Fallback

### Upload Failure

Nếu upload lên R2 fail:
- ✅ Log error với `console.error`
- ✅ **Fallback**: Giữ file local và lưu local path vào DB
- ✅ Service vẫn hoạt động bình thường

```typescript
try {
  const r2Url = await this.storageService.uploadFile(localPath, r2Key);
  finalStoragePath = r2Url;
  await unlink(localPath); // Delete temp file
} catch (e) {
  console.error('[SNAPSHOT] R2 upload failed, keeping local file', e.message);
  finalStoragePath = localPath; // Fallback to local
}
```

### Download Handling

Controller tự động detect R2 URL vs local path:

```typescript
if (this.storageService.isR2Url(rec.storagePath)) {
  // R2 URL → redirect
  return res.redirect(rec.storagePath);
} else {
  // Local file → sendFile
  return res.sendFile(rec.storagePath);
}
```

### Delete Handling

Service tự động detect và xóa từ đúng storage:

```typescript
if (this.storageService.isR2Url(snap.storagePath)) {
  const r2Key = this.storageService.extractR2Key(snap.storagePath);
  await this.storageService.deleteFile(r2Key);
} else if (existsSync(snap.storagePath)) {
  await unlink(snap.storagePath);
}
```

---

## Testing

### Test R2 Upload (Snapshot)

**1. Test với FAKE strategy (không cần camera):**
```bash
curl -X POST http://localhost:3000/snapshots/capture \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"cameraId": "YOUR_CAMERA_ID", "strategy": "FAKE"}'
```

**2. Kiểm tra response:**
```json
{
  "id": "abc-123",
  "storagePath": "https://a1000a80a775f57fe92ea14196486a3a.r2.cloudflarestorage.com/iotek/snapshots/cam1/1729440000000-abc123.jpg"
}
```

**3. Verify trên R2:**
- Vào Cloudflare dashboard → R2 → Bucket `iotek`
- Kiểm tra file tồn tại trong `snapshots/cam1/`

### Test R2 Upload (Recording)

**1. Start recording:**
```bash
curl -X POST http://localhost:3000/recordings/start \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"cameraId": "YOUR_CAMERA_ID", "durationSec": 10, "strategy": "FAKE"}'
```

**2. Wait 10 seconds, then check status:**
```bash
curl http://localhost:3000/recordings/{recordingId} \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**3. Verify storagePath is R2 URL:**
```json
{
  "status": "COMPLETED",
  "storagePath": "https://...r2.cloudflarestorage.com/iotek/recordings/cam1/..."
}
```

### Test Download

```bash
curl -L http://localhost:3000/recordings/{recordingId}/download \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -o test.mp4
```

Nếu R2 mode → sẽ redirect đến R2 URL và download file.

---

## Migration Strategy

### Legacy Data Migration

Nếu đã có files local cần migrate lên R2:

**Script mẫu** (`scripts/migrate-to-r2.ts`):
```typescript
import { AppDataSource } from '../src/data-source';
import { Snapshot } from '../src/typeorm/entities/snapshot.entity';
import { StorageService } from '../src/modules/storage/storage.service';

async function migrateSnapshotsToR2() {
  await AppDataSource.initialize();
  const snapRepo = AppDataSource.getRepository(Snapshot);
  const storageService = new StorageService();

  const snapshots = await snapRepo.find();
  
  for (const snap of snapshots) {
    if (!storageService.isR2Url(snap.storagePath) && existsSync(snap.storagePath)) {
      const filename = snap.storagePath.split('/').pop();
      const r2Key = `snapshots/${snap.camera.id}/${Date.now()}-${filename}`;
      
      try {
        const r2Url = await storageService.uploadFile(snap.storagePath, r2Key);
        snap.storagePath = r2Url;
        await snapRepo.save(snap);
        
        // Delete local file
        await unlink(snap.storagePath);
        console.log(`Migrated snapshot ${snap.id} to R2`);
      } catch (e) {
        console.error(`Failed to migrate snapshot ${snap.id}:`, e.message);
      }
    }
  }
}
```

### Gradual Rollout

**Phase 1:** Deploy với `STORAGE_MODE=local` (default)
- Kiểm tra không có regression
- Service vẫn hoạt động bình thường

**Phase 2:** Test R2 trên local/staging
- Set `STORAGE_MODE=r2` trên local
- Capture vài snapshots/recordings
- Verify files upload lên R2

**Phase 3:** Enable R2 trên production
- Set `STORAGE_MODE=r2` trên Coolify
- Redeploy service
- Monitor logs cho R2 upload success/failure

**Phase 4:** Cleanup old files
- Sau vài ngày confirm R2 hoạt động ổn định
- Xóa old files trong `/tmp/` (hoặc để container restart tự cleanup)

---

## Troubleshooting

### Lỗi: "Failed to upload to R2"

**Nguyên nhân:**
- Credentials sai
- Network không thể reach R2 endpoint
- Bucket không tồn tại
- Permissions không đủ

**Debug:**
```bash
# Check R2 credentials
echo $R2_ACCESS_KEY_ID
echo $R2_BUCKET_NAME

# Test R2 connectivity từ container
curl -I https://a1000a80a775f57fe92ea14196486a3a.r2.cloudflarestorage.com
```

**Fix:**
- Verify credentials trên Cloudflare dashboard
- Check firewall/network rules
- Verify bucket name chính xác

### Lỗi: "Cannot find module './storage.service'"

**Nguyên nhân:** TypeScript chưa compile files mới

**Fix:**
```bash
npm run build
# hoặc restart dev server
npm run start:dev
```

### Files không tự xóa sau upload

**Nguyên nhân:** Upload thành công nhưng `unlink()` fail

**Debug:** Check logs cho warnings:
```
[SNAPSHOT] Failed to delete local temp file: ...
```

**Impact:** Low - files sẽ bị xóa khi container restart (ephemeral storage)

### R2 URL không accessible

**Nguyên nhân:** Bucket chưa enable public access

**Fix:**
- Vào Cloudflare dashboard → R2 → Bucket settings
- Enable "Public Access" hoặc "R2.dev subdomain"
- Hoặc setup custom domain với public access

---

## Performance Considerations

### Upload Time

- **Snapshot** (JPG ~500KB): ~1-2 seconds upload time
- **Recording** (MP4 ~10MB for 30s): ~5-10 seconds upload time

**Optimization:**
- Upload chạy **async** trong background (không block API response)
- User nhận response ngay khi FFmpeg complete (trước khi upload)
- Upload xong → update DB record với R2 URL

### Bandwidth

- **Local mode**: Server stream files → client (dùng bandwidth server)
- **R2 redirect mode**: Client download trực tiếp từ R2 (tiết kiệm bandwidth server)

**Trade-off:**
- Redirect: Nhanh hơn, tiết kiệm server bandwidth, nhưng expose R2 URL
- Proxy: Bảo mật hơn (kiểm soát access), nhưng tốn bandwidth server

### Cost

**Cloudflare R2 Pricing:**
- Storage: $0.015/GB/month
- Class A operations (upload): $4.50/million requests
- Class B operations (download): $0.36/million requests
- **Egress: FREE** (không charge bandwidth ra ngoài)

**Ước tính:**
- 1000 snapshots/day (~500MB) = ~$0.23/month
- 100 recordings/day (~10GB) = ~$0.15/month
- Total: **~$0.40/month** cho storage

---

## Security

### Credentials

**QUAN TRỌNG:** Không commit credentials vào Git!

- ✅ Dùng environment variables
- ✅ Add `.env` vào `.gitignore`
- ✅ Rotate credentials định kỳ trên Cloudflare dashboard

### Access Control

- R2 public URLs có thể truy cập bởi bất kỳ ai có link
- **Recommendation:** Nếu cần bảo mật cao:
  - Không enable public access
  - Dùng proxy mode (uncomment code trong controller)
  - Implement pre-signed URLs (expire sau X giờ)

### R2 Bucket Permissions

Đảm bảo R2 API token có permissions:
- ✅ `Object Read`
- ✅ `Object Write`
- ✅ `Object Delete`

---

## Future Enhancements

### 1. Pre-signed URLs

Generate temporary URLs expire sau X giờ:
```typescript
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const command = new GetObjectCommand({
  Bucket: this.bucketName,
  Key: r2Key,
});

const url = await getSignedUrl(this.s3Client, command, { expiresIn: 3600 }); // 1 hour
```

### 2. Thumbnail Generation

Generate thumbnails cho snapshots:
```typescript
// After upload original
const thumbnailKey = `thumbnails/${cameraId}/${timestamp}-thumb.jpg`;
await generateThumbnail(localPath, 200, 150);
await uploadFile(thumbnailPath, thumbnailKey);
```

### 3. Compression

Compress recordings trước khi upload:
```typescript
// Use FFmpeg to compress
ffmpeg -i input.mp4 -c:v libx264 -crf 28 -preset fast output.mp4
```

### 4. Multi-region Replication

Setup R2 replication cho disaster recovery:
- Primary bucket: `iotek` (region A)
- Replica bucket: `iotek-backup` (region B)

---

## Summary

✅ **Đã implement:**
- StorageModule với R2 upload/download
- SnapshotService upload snapshots lên R2
- RecordingService upload recordings lên R2
- Controllers handle R2 URLs (redirect mode)
- Fallback to local storage nếu R2 fail
- Environment variables configuration

✅ **Backward compatible:**
- Vẫn hỗ trợ local storage mode
- Detect tự động R2 URL vs local path
- Không cần database migration

✅ **Production ready:**
- Error handling với fallback
- Async upload không block API
- Credentials từ environment variables
- Cleanup temp files sau upload

🚀 **Next steps:**
1. Add R2 credentials vào Coolify environment
2. Set `STORAGE_MODE=r2`
3. Redeploy service
4. Test snapshot/recording với camera thật
5. Verify files upload lên R2 bucket
