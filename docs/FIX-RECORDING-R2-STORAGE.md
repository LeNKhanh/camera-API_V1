# Fix: Recording Storage - Upload trực tiếp lên R2 Cloud

## 🎯 Mục tiêu

Thay đổi logic recording để:
- ✅ **Không lưu path local** trong response ban đầu
- ✅ **Upload lên R2** sau khi recording hoàn thành
- ✅ **Lưu R2 URL** vào database (storage_path)
- ✅ **Cleanup file local** sau khi upload thành công

## 🔧 Các thay đổi

### 1. RecordingService - Fix Response

**File:** `src/modules/recording/recording.service.ts`

#### Trước đây:
```typescript
// Response trả về local temp path
return { 
  id: rec.id, 
  storagePath: rec.storagePath,  // ❌ Local path: C:\tmp\xyz.mp4
  status: 'RUNNING' 
};
```

#### Sau khi fix:
```typescript
// Response không expose local path
return { 
  id: rec.id, 
  status: 'RUNNING',
  strategy: 'FAKE' // hoặc 'RTSP'
};
```

### 2. Upload to R2 sau khi Recording hoàn thành

Logic đã có sẵn trong helper method `uploadRecordingToR2()`:

```typescript
private async uploadRecordingToR2(
  recId: string, 
  localPath: string, 
  cameraId: string
): Promise<string> {
  if (process.env.STORAGE_MODE !== 'r2') {
    return localPath; // Keep local if R2 disabled
  }

  try {
    const filename = localPath.split(/[\\/]/).pop() || `${Date.now()}.mp4`;
    const r2Key = `recordings/${cameraId}/${Date.now()}-${filename}`;
    
    // Upload to R2
    const r2Url = await this.storageService.uploadFile(localPath, r2Key);
    
    // Delete local temp file
    await unlink(localPath);
    
    return r2Url; // ✅ R2 URL
  } catch (e) {
    console.error('[RECORDING] R2 upload failed, keeping local file', e.message);
    return localPath; // Fallback to local on error
  }
}
```

### 3. Update storagePath sau khi hoàn thành

#### FAKE Strategy (natural completion):
```typescript
child.on('close', async (code) => {
  if (a?.natural) {
    // Upload to R2 and get URL
    const finalPath = await this.uploadRecordingToR2(rec.id, outPath, cameraId);
    
    // Update DB with R2 URL ✅
    await this.recRepo.update(rec.id, { 
      status: 'COMPLETED', 
      endedAt: new Date(), 
      storagePath: finalPath  // R2 URL
    });
  }
});
```

#### RTSP Strategy:
```typescript
child.on('close', async (code) => {
  if (code === 0) {
    // Upload to R2 and get URL
    const finalPath = await this.uploadRecordingToR2(rec.id, outPath, cameraId);
    
    // Update DB with R2 URL ✅
    await this.recRepo.update(rec.id, { 
      status: 'COMPLETED', 
      endedAt: new Date(), 
      storagePath: finalPath  // R2 URL
    });
  }
});
```

### 4. Fix stopRecording() - Upload khi user stop

**Trước đây:** Chỉ update status, không upload

**Sau khi fix:**
```typescript
async stopRecording(id: string) {
  // ... kill FFmpeg process ...
  
  // Upload to R2 khi user stop ✅
  const currentPath = rec.storagePath;
  let finalPath = currentPath;
  
  // Wait for FFmpeg to flush
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  try {
    finalPath = await this.uploadRecordingToR2(rec.id, currentPath, rec.camera.id);
  } catch (e) {
    console.error('[RECORDING] Failed to upload stopped recording', e.message);
  }
  
  // Update with R2 URL ✅
  await this.recRepo.update(rec.id, { 
    status: 'STOPPED', 
    endedAt: new Date(), 
    errorMessage: 'STOPPED_BY_USER',
    storagePath: finalPath  // R2 URL
  });
}
```

### 5. StorageService - Helper Methods

**File:** `src/modules/storage/storage.service.ts`

Đã có sẵn các methods cần thiết:

```typescript
/**
 * Kiểm tra xem path có phải R2 URL không
 */
isR2Url(path: string): boolean {
  if (!path) return false;
  if (this.publicUrlBase && path.startsWith(this.publicUrlBase)) return true;
  const endpoint = process.env.R2_ENDPOINT || '';
  if (endpoint && path.startsWith(endpoint)) return true;
  return path.startsWith('http://') || path.startsWith('https://');
}

/**
 * Extract R2 key từ URL
 * https://iotek.tn-cdn.net/recordings/cam-id/123.mp4 → recordings/cam-id/123.mp4
 */
extractR2Key(url: string): string | null {
  if (!this.isR2Url(url)) return null;
  
  try {
    const urlObj = new URL(url);
    let pathname = urlObj.pathname.substring(1);
    
    // Remove bucket name if present
    if (pathname.startsWith(`${this.bucketName}/`)) {
      pathname = pathname.substring(this.bucketName.length + 1);
    }
    
    return pathname;
  } catch {
    return null;
  }
}
```

### 6. RecordingController - Support R2 URL

**File:** `src/modules/recording/recording.controller.ts`

Download endpoint đã support cả R2 URL và local path:

```typescript
@Get(':id/download')
async download(@Param('id') id: string, @Res() res: Response) {
  const rec = await this.svc.getRecording(id);
  
  if (this.storageService.isR2Url(rec.storagePath)) {
    // R2 URL - redirect to R2 ✅
    return res.redirect(rec.storagePath);
  } else {
    // Local file - use sendFile
    res.setHeader('Content-Type', 'video/mp4');
    return res.sendFile(rec.storagePath);
  }
}
```

## 📊 Workflow Mới

### POST /recordings/start

```
1. Client → POST /recordings/start { cameraId, durationSec, strategy }

2. Server:
   - Tạo temp file: C:\tmp\uuid.mp4
   - Lưu DB: status='PENDING', storagePath=temp_path (tạm)
   - Spawn FFmpeg
   - Update DB: status='RUNNING'
   - Response: { id, status: 'RUNNING', strategy }  ✅ No temp path!

3. FFmpeg completes:
   - Upload to R2: recordings/{cameraId}/{timestamp}-{filename}.mp4
   - Get R2 URL: https://iotek.tn-cdn.net/recordings/...
   - Update DB: status='COMPLETED', storagePath=R2_URL  ✅
   - Delete temp file: unlink(C:\tmp\uuid.mp4)
```

### GET /recordings/:id

```
Response:
{
  "id": "uuid",
  "camera_id": "uuid",
  "storage_path": "https://iotek.tn-cdn.net/recordings/cam-id/123.mp4", ✅
  "duration_sec": 10,
  "started_at": "2025-10-20T07:00:00.000Z",
  "ended_at": "2025-10-20T07:00:10.000Z",
  "status": "COMPLETED",
  "strategy": "FAKE",
  "created_at": "2025-10-20T07:00:00.000Z"
}
```

### GET /recordings/:id/download

```
- Check if storage_path is R2 URL
- If R2 URL → redirect to R2  ✅
- If local path → sendFile
```

## ✅ Kết quả

### Trước khi fix:
- ❌ Response trả về local path: `C:\tmp\uuid.mp4`
- ❌ Database lưu local path
- ❌ Download chỉ work với local files
- ❌ Không có cleanup temp files

### Sau khi fix:
- ✅ Response không expose local path
- ✅ Database lưu R2 URL: `https://iotek.tn-cdn.net/recordings/...`
- ✅ Download work với cả R2 URL và local path
- ✅ Temp files được cleanup tự động
- ✅ Scalable - files trên cloud
- ✅ CDN-ready với custom domain

## 🧪 Testing

### 1. Start Recording (FAKE strategy):
```bash
POST /recordings/start
{
  "cameraId": "49e77c80-af6e-4ac6-b0ea-b4f018dacac7",
  "durationSec": 10,
  "strategy": "FAKE"
}

Response:
{
  "id": "recording-uuid",
  "status": "RUNNING",
  "strategy": "FAKE"
}
# ✅ No local path exposed!
```

### 2. Get Recording (after completion):
```bash
GET /recordings/{id}

Response:
{
  "id": "recording-uuid",
  "storage_path": "https://iotek.tn-cdn.net/recordings/cam-id/1729400000000-file.mp4",
  "status": "COMPLETED",
  ...
}
# ✅ R2 URL returned!
```

### 3. Download Recording:
```bash
GET /recordings/{id}/download

→ 302 Redirect to R2 URL
→ https://iotek.tn-cdn.net/recordings/...
# ✅ Browser can play video directly!
```

### 4. Stop Recording (user-initiated):
```bash
PUT /recordings/{id}/stop

→ Upload to R2 ✅
→ Update storage_path with R2 URL ✅
→ Delete temp file ✅
```

## 🔍 Environment Variables

```env
# Enable R2 storage
STORAGE_MODE=r2

# R2 Configuration
R2_ENDPOINT=https://a1000a80a775f57fe92ea14196486a3a.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=0c10ee4c19fe892894a9c5311798a69c
R2_SECRET_ACCESS_KEY=20db186ea3ebb14ba05254a9b82b1f033fef297335ab8d4e7874e90634ca36bb
R2_BUCKET_NAME=iotek

# R2 Public URL (custom domain)
R2_PUBLIC_URL=https://iotek.tn-cdn.net

# Temp directory
RECORD_DIR=/tmp  # Linux
# RECORD_DIR=C:\\tmp  # Windows
```

## 📝 Files Changed

1. **`src/modules/recording/recording.service.ts`**
   - Fix response không expose local path
   - Add upload logic cho stopRecording()
   - Update storagePath với R2 URL

2. **`src/modules/storage/storage.service.ts`**
   - Add `isR2Url()` helper
   - Add `extractR2Key()` helper

3. **`src/modules/recording/recording.controller.ts`**
   - Already supports R2 URL redirect

## 🎉 Benefits

- ✅ **Security**: Không expose local filesystem paths
- ✅ **Scalability**: Files trên cloud, không giới hạn disk space
- ✅ **Performance**: CDN delivery với custom domain
- ✅ **Reliability**: Auto cleanup temp files
- ✅ **Flexibility**: Fallback to local nếu R2 fail

---

**Fixed:** October 20, 2025  
**Issue:** Recording lưu local path thay vì R2 URL  
**Resolution:** Upload to R2 sau completion, update storagePath với R2 URL, cleanup temp files
